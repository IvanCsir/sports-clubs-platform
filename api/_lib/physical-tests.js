const DEFAULT_PHYSICAL_TESTS = [
  { key: 'broadJump', name: 'Broad Jump', type: 'Salto horizontal', category: 'potencia', unit: 'm', direction: 'higher', decimals: 2, maxAttempts: 3 },
  { key: 'cmj', name: 'CMJ', type: 'Salto vertical', category: 'potencia', unit: 'cm', direction: 'higher', decimals: 1, maxAttempts: 3 },
  { key: 'agility', name: 'Test 5-10-5', type: 'Agilidad', category: 'agilidad', unit: 'seg', direction: 'lower', decimals: 2, maxAttempts: 3 },
  { key: 'sprint', name: 'Velocidad 40 mts', type: 'Velocidad', category: 'velocidad', unit: 'seg', direction: 'lower', decimals: 2, maxAttempts: 3 },
  { key: 'yoyo', name: 'Yo-Yo Test', type: 'Resistencia', category: 'resistencia', unit: 'm', direction: 'higher', decimals: 0, maxAttempts: 3 },
  { key: 'bench', name: 'Press de banca', type: 'Fuerza superior', category: 'fuerza', unit: 'kg', direction: 'higher', decimals: 1, maxAttempts: 3 },
  { key: 'deadlift', name: 'Peso muerto', type: 'Cadena posterior', category: 'fuerza', unit: 'kg', direction: 'higher', decimals: 1, maxAttempts: 3 },
  { key: 'squat', name: 'Sentadilla', type: 'Fuerza inferior', category: 'fuerza', unit: 'kg', direction: 'higher', decimals: 1, maxAttempts: 3 },
  { key: 'platform', name: 'Plataforma', type: 'Potencia', category: 'potencia', unit: '', direction: 'higher', decimals: 1, maxAttempts: 3 }
];

function mapDefinition(row) {
  return {
    key: row.test_key,
    name: row.name,
    type: row.category,
    category: row.category,
    unit: row.unit || '',
    direction: row.direction || 'neutral',
    higherIsBetter: row.direction === 'higher' ? true : row.direction === 'lower' ? false : null,
    decimals: Number(row.decimals ?? 2),
    maxAttempts: Number(row.max_attempts ?? 3),
    custom: true,
    active: row.active !== false
  };
}

module.exports = { DEFAULT_PHYSICAL_TESTS, mapDefinition };
