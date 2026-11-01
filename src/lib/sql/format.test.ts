import { describe, expect, it } from 'vitest'

import { formatSql } from './format'

describe('formatSql', () => {
  it('puts clauses on their own lines with leading commas and conditions', () => {
    expect(
      formatSql(
        'select col, col2 from table1 as t1 inner join table2 as t2 on t2.id = t1.id where t1.col1 = some and t2.col1 = some1 order by col desc',
      ),
    ).toBe(
      [
        'SELECT col',
        '\t, col2',
        'FROM table1 AS t1',
        'INNER JOIN table2 AS t2 ON t2.id = t1.id',
        'WHERE t1.col1 = some',
        '\tAND t2.col1 = some1',
        'ORDER BY col DESC',
      ].join('\n'),
    )
  })

  it('indents subqueries and CTEs one level', () => {
    expect(
      formatSql(
        'with a as (select x from t) select * from a where exists (select 1 from z where z.id = a.x)',
      ),
    ).toBe(
      [
        'WITH a AS (',
        '\tSELECT x',
        '\tFROM t',
        ')',
        'SELECT *',
        'FROM a',
        'WHERE EXISTS (',
        '\tSELECT 1',
        '\tFROM z',
        '\tWHERE z.id = a.x',
        ')',
      ].join('\n'),
    )
  })

  it('keeps calls, IN lists, CASE and BETWEEN on one line', () => {
    expect(
      formatSql(
        "select count(*), case when a > 1 and b < 2 then 'x' else -1 end from t where d between 1 and 5 and e in (1, 2)",
      ),
    ).toBe(
      [
        'SELECT count(*)',
        "\t, CASE WHEN a > 1 AND b < 2 THEN 'x' ELSE -1 END",
        'FROM t',
        'WHERE d BETWEEN 1 AND 5',
        '\tAND e IN (1, 2)',
      ].join('\n'),
    )
  })

  it('keeps strings, comments and qualified names as written', () => {
    expect(
      formatSql("-- note\nselect t.end, 'and, or' from t -- trailing"),
    ).toBe(
      ['-- note', 'SELECT t.end', "\t, 'and, or'", 'FROM t -- trailing'].join(
        '\n',
      ),
    )
  })

  it('separates statements with a blank line', () => {
    expect(formatSql('delete from t where id = 1; select 1;')).toBe(
      'DELETE FROM t\nWHERE id = 1;\n\nSELECT 1;',
    )
  })

  it('gives the same text when run again', () => {
    const once = formatSql(
      'insert into t (a, b) values (1, 2), (3, 4); update t set a = 1, b = 2 where c = 3',
    )
    expect(formatSql(once)).toBe(once)
  })
})
