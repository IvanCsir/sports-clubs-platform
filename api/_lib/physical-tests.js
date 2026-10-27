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

module.exports = { mapDefinition };
