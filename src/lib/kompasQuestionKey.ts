/**
 * Conservative key for reusing prepared Kompas answers.
 *
 * This is not semantic question understanding. It is a fail-closed cache gate:
 * when intent, requested facets, or meaningful topic tokens differ, the prepared
 * answer is not reused and the normal grounded answer path remains available.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "as", "at", "by",
  "for", "from", "in", "into", "on", "of", "to", "with", "without", "about",
  "around", "through", "across", "between", "during", "after", "before", "over",
  "under", "up", "down", "out", "off", "per", "via", "what", "which", "who",
  "why", "how", "where", "when", "is", "are", "was", "were", "be", "been",
  "being", "do", "does", "did", "have", "has", "had", "can", "could", "would",
  "should", "will", "may", "might", "must", "you", "your", "yours", "we", "our",
  "ours", "they", "their", "them", "it", "its", "me", "my", "mine", "us", "i",
  "he", "she", "him", "her", "this", "that", "these", "those", "there", "here",
  "one", "ones", "some", "any", "all", "each", "every", "both", "either",
  "neither", "much", "many", "more", "less", "most", "few", "several",
  "please", "kindly", "briefly", "actually", "really", "just", "basically",
  "also", "again", "now", "today", "currently", "current", "new", "old",
  "previous", "recent", "typical", "main", "primary", "core", "key", "important",
  "good", "best", "better", "stronger", "related", "relevant", "specific",
  ¶»§q«^