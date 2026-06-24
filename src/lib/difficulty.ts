export function predictDifficulty(question: string): string {
  if (!question || question.trim().length === 0) {
    return 'Unrated';
  }

  const text = question.toLowerCase();
  
  // Advanced keywords that indicate a hard query
  const hardKeywords = [
    'error', 'crash', 'exception', 'architecture', 'database', 'vector', 
    'qdrant', 'deployment', 'vercel', 'pipeline', 'infrastructure', 'security',
    'authentication', 'oauth', 'middleware', 'serverless', 'optimize', 'bug',
    'fail', 'timeout', 'memory', 'leak', 'corrupt'
  ];
  
  // Medium keywords
  const mediumKeywords = [
    'how to', 'install', 'setup', 'configure', 'update', 'api', 
    'endpoint', 'frontend', 'backend', 'component', 'routing', 'state',
    'where', 'when', 'policy', 'procedure', 'guideline'
  ];

  let hardCount = 0;
  let mediumCount = 0;

  for (const word of hardKeywords) {
    if (text.includes(word)) hardCount++;
  }

  for (const word of mediumKeywords) {
    if (text.includes(word)) mediumCount++;
  }

  const length = text.split(/\s+/).length;

  if (hardCount >= 2 || (hardCount >= 1 && length > 30)) {
    return 'Hard';
  }

  if (mediumCount >= 2 || hardCount === 1 || (mediumCount >= 1 && length > 15) || length > 40) {
    return 'Medium';
  }

  if (length < 5) {
    return 'Unrated';
  }

  return 'Easy';
}
