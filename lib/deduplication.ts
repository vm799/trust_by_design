/**
 * Deduplication Service
 *
 * Prevents duplicate clients and technicians with:
 * - Fuzzy name matching (Levenshtein distance)
 * - Email/phone exact matching
 * - Merge suggestions for near-duplicates
 * - Automatic cleanup of obvious duplicates
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType: 'exact' | 'fuzzy' | 'none';
  matchedEntity?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    similarity: number;
  };
  suggestions: DuplicateSuggestion[];
}

export interface DuplicateSuggestion {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  similarity: number;
  matchReason: string;
}

export interface Entity {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

// ============================================================================
// FUZZY MATCHING (Levenshtein Distance)
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity percentage (0-100)
 */
function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const normalizedA = normalizeString(a);
  const normalizedB = normalizeString(b);

  if (normalizedA === normalizedB) return 100;

  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  if (maxLength === 0) return 100;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '') // Remove special chars
    .replace(/\s+/g, '');       // Remove spaces
}

/**
 * Normalize phone number
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}

/**
 * Normalize email
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

const SIMILARITY_THRESHOLD = 85; // 85% similarity = likely duplicate
const SUGGESTION_THRESHOLD = 70; // 70% similarity = show as suggestion

/**
 * Check if a new client would be a duplicate
 */
export function checkClientDuplicate(
  newClient: { name: string; email?: string; phone?: string },
  existingClients: Entity[]
): DuplicateCheckResult {
  return checkEntityDuplicate(newClient, existingClients);
}

/**
 * Check if a new technician would be a duplicate
 */
export function checkTechnicianDuplicate(
  newTech: { name: string; email?: string; phone?: string },
  existingTechs: Entity[]
): DuplicateCheckResult {
  return checkEntityDuplicate(newTech, existingTechs);
}

/**
 * Generic duplicate check
 */
function checkEntityDuplicate(
  newEntity: { name: string; email?: string; phone?: string },
  existingEntities: Entity[]
): DuplicateCheckResult {
  const result: DuplicateCheckResult = {
    isDuplicate: false,
    matchType: 'none',
    suggestions: [],
  };

  if (!newEntity.name || existingEntities.length === 0) {
    return result;
  }

  normalizeString(newEntity.name);
  const normalizedNewEmail = newEntity.email ? normalizeEmail(newEntity.email) : null;
  const normalizedNewPhone = newEntity.phone ? normalizePhone(newEntity.phone) : null;

  for (const existing of existingEntities) {
    // Check exact email match first (highest confidence)
    if (normalizedNewEmail && existing.email) {
      const existingEmail = normalizeEmail(existing.email);
      if (normalizedNewEmail === existingEmail) {
        result.isDuplicate = true;
        result.matchType = 'exact';
        result.matchedEntity = {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
          similarity: 100,
        };
        return result;
      }
    }

    // Check exact phone match
    if (normalizedNewPhone && existing.phone) {
      const existingPhone = normalizePhone(existing.phone);
      if (normalizedNewPhone === existingPhone) {
        result.isDuplicate = true;
        result.matchType = 'exact';
        result.matchedEntity = {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
          similarity: 100,
        };
        return result;
      }
    }

    // Check name similarity
    const nameSimilarity = calculateSimilarity(newEntity.name, existing.name);

    if (nameSimilarity >= SIMILARITY_THRESHOLD) {
      // High similarity - likely duplicate
      if (!result.isDuplicate || nameSimilarity > (result.matchedEntity?.similarity || 0)) {
        result.isDuplicate = true;
        result.matchType = 'fuzzy';
        result.matchedEntity = {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
          similarity: nameSimilarity,
        };
      }
    } else if (nameSimilarity >= SUGGESTION_THRESHOLD) {
      // Medium similarity - suggest as possible match
      result.suggestions.push({
        id: existing.id,
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        similarity: nameSimilarity,
        matchReason: `Name is ${nameSimilarity}% similar`,
      });
    }
  }

  // Sort suggestions by similarity
  result.suggestions.sort((a, b) => b.similarity - a.similarity);

  // Limit suggestions
  result.suggestions = result.suggestions.slice(0, 5);

  return result;
}

// ============================================================================
// MERGE UTILITIES
// ============================================================================

/**
 * Merge two client records (keep the older one, update with new data)
 */
export function mergeClients(
  primary: Entity,
  secondary: Entity
): Entity {
  return {
    id: primary.id, // Keep primary ID
    name: primary.name || secondary.name,
    email: primary.email || secondary.email,
    phone: primary.phone || secondary.phone,
  };
}

/**
 * Find all duplicate groups in a list
 */
export function findDuplicateGroups(entities: Entity[]): Entity[][] {
  const groups: Entity[][] = [];
  const processed = new Set<string>();

  for (const entity of entities) {
    if (processed.has(entity.id)) continue;

    const group = [entity];
    processed.add(entity.id);

    for (const other of entities) {
      if (processed.has(other.id)) continue;

      const check = checkEntityDuplicate(
        { name: entity.name, email: entity.email, phone: entity.phone },
        [other]
      );

      if (check.isDuplicate) {
        group.push(other);
        processed.add(other.id);
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (international)
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // At least 7 digits, max 15 (international standard)
  return normalized.length >= 7 && normalized.length <= 15;
}

/**
 * Validate entity before creation
 */
export function validateEntity(
  entity: { name: string; email?: string; phone?: string }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Name is required
  if (!entity.name || entity.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }

  // Email validation (if provided)
  if (entity.email && !isValidEmail(entity.email)) {
    errors.push('Invalid email format');
  }

  // Phone validation (if provided)
  if (entity.phone && !isValidPhone(entity.phone)) {
    errors.push('Invalid phone format (must be 7-15 digits)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Format duplicate warning message
 */
export function formatDuplicateWarning(result: DuplicateCheckResult, entityType: string): string {
  if (!result.isDuplicate) return '';

  if (result.matchType === 'exact') {
    const field = result.matchedEntity?.email ? 'email' : 'phone';
    return `A ${entityType} with this ${field} already exists: "${result.matchedEntity?.name}"`;
  }

  return `This looks similar to existing ${entityType}: "${result.matchedEntity?.name}" (${result.matchedEntity?.similarity}% match)`;
}

/**
 * Format suggestion message
 */
export function formatSuggestionMessage(suggestions: DuplicateSuggestion[]): string {
  if (suggestions.length === 0) return '';

  return `Did you mean: ${suggestions.map(s => `"${s.name}"`).join(', ')}?`;
}
