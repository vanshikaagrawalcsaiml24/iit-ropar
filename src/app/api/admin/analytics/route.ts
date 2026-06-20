import { cookies } from 'next/headers';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// Helper to check super admin auth
async function isSuperAdmin(): Promise<boolean> {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token');
    const adminRole = cookieStore.get('admin_role');
    return !!(adminToken?.value === 'authenticated' && adminRole?.value === 'super_admin');
}

export async function GET() {
    try {
        if (!(await isSuperAdmin())) {
            return Response.json({ error: 'Unauthorized — Super Admin access required' }, { status: 403 });
        }

        const db = await getDb();

        // 1. Overall Surveillance
        const totalFaqs = await db.collection('faqs').countDocuments();
        const totalAdmins = await db.collection('admins').countDocuments();

        // Aggregate query stats
        const queryStats = await db.collection('queries').aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                    inReview: { $sum: { $cond: [{ $eq: ['$status', 'in-review'] }, 1, 0] } },
                    escalated: { $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] } },
                    resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
                    totalResolutionTimeMs: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$status', 'resolved'] }, { $ne: ['$resolvedAt', null] }, { $ne: ['$createdAt', null] }] },
                                { $subtract: ['$resolvedAt', '$createdAt'] },
                                0
                            ]
                        }
                    }
                }
            }
        ]).toArray();

        const qStats = queryStats[0] || { total: 0, active: 0, inReview: 0, escalated: 0, resolved: 0, totalResolutionTimeMs: 0 };
        const resolutionRate = qStats.total > 0 ? (qStats.resolved / qStats.total) * 100 : 0;

        // Avg resolution time in hours
        const avgResMs = qStats.resolved > 0 ? qStats.totalResolutionTimeMs / qStats.resolved : 0;
        const avgResHrs = avgResMs / (1000 * 60 * 60);

        // 2. Individual Surveillance (per-user stats)
        // Gather how many queries each user raised
        const userRaised = await db.collection('queries').aggregate([
            {
                $group: {
                    _id: '$username',
                    queriesRaised: { $sum: 1 },
                    userId: { $first: '$userId' }
                }
            }
        ]).toArray();

        // Gather how many queries each user answered (provided proposedAnswer)
        const userAnswered = await db.collection('queries').aggregate([
            { $match: { answeredByUsername: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: '$answeredByUsername',
                    queriesAnswered: { $sum: 1 }
                }
            }
        ]).toArray();

        // Combine individual stats
        const userStatsMap = new Map();

        userRaised.forEach(ur => {
            if (!ur._id) return;
            userStatsMap.set(ur._id, { username: ur._id, queriesRaised: ur.queriesRaised, queriesAnswered: 0 });
        });

        userAnswered.forEach(ua => {
            if (!ua._id) return;
            if (userStatsMap.has(ua._id)) {
                userStatsMap.get(ua._id).queriesAnswered = ua.queriesAnswered;
            } else {
                userStatsMap.set(ua._id, { username: ua._id, queriesRaised: 0, queriesAnswered: ua.queriesAnswered });
            }
        });

        const individualStats = Array.from(userStatsMap.values()).sort((a, b) => b.queriesAnswered - a.queriesAnswered);

        return Response.json({
            overall: {
                totalFaqs,
                totalAdmins,
                queriesTracker: {
                    total: qStats.total,
                    active: qStats.active,
                    inReview: qStats.inReview,
                    escalated: qStats.escalated,
                    resolved: qStats.resolved,
                },
                resolutionRate: parseFloat(resolutionRate.toFixed(1)),
                avgResolutionHours: parseFloat(avgResHrs.toFixed(1)),
            },
            individual: individualStats
        });

    } catch (error) {
        console.error('GET /api/admin/analytics error:', error);
        return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
