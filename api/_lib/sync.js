const { getPool } = require('./db');

const BOARDS = {
  icoo1: {
    id: '1946541891',
    activeGroups: [
      'group_mm2spj74','group_mm1gtwmy','group_mm1hkzm3','group_mm0djdxw',
      'group_mkth6fvb','group_mkzt3j5e','group_mkztk3s9','group_mkznnygg','group_mm12k1mq',
      'group_mm2k19fd','group_mkrnarw7','group_mkrqt1ve','duplicate_of_new_person__2_mkn18v6e',
      'group_mm0rjy55','group_mm0re4z','group_mm07wvxc'
    ]
  },
  icoo2: {
    id: '5026837082',
    activeGroups: [
      'group_mm1df68','group_mm299c7c','new_group_mkkkvh9','group_mkzmq3rt','new_group_mkkkzs3a',
      'group_mkse6cd1','group_mkrnj7kf','group_mm0vgbkx','group_mm0vy62n','group_mm0asgwv',
      'group_mm08qzsq','group_mm2mvnnf','group_mm2mrf2p'
    ]
  }
};

const F = `id name group{title} column_values(ids:["status","priority_Mjj6rOKH","date_Mjj8FZtc","dropdown_Mjj6ySAb"]){id text}`;

async function mondayFetch(query, variables = {}) {
  const r = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.MONDAY_API_TOKEN,
      'API-Version': '2024-01'
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await r.json();
  if (json.errors) throw new Error(json.errors.map(e => e.message || e).join('; '));
  return json.data;
}

async function fetchBoardItems(boardKey) {
  const board = BOARDS[boardKey];
  const items = [];
  const d = await mondayFetch(
    `query($id:ID!,$gids:[String]){boards(ids:[$id]){groups(ids:$gids){id items_page(limit:500){cursor items{${F}}}}}}`,
    { id: board.id, gids: board.activeGroups }
  );
  const pending = [];
  for (const g of d.boards[0].groups) {
    items.push(...g.items_page.items.map(r => ({ ...r, boardKey })));
    if (g.items_page.cursor) pending.push(g.items_page.cursor);
  }
  for (let cursor of pending) {
    while (cursor) {
      const nd = await mondayFetch(
        `query($c:String!){next_items_page(limit:500,cursor:$c){cursor items{${F}}}}`, { c: cursor }
      );
      const np = nd.next_items_page;
      if (!np?.items?.length) break;
      items.push(...np.items.map(r => ({ ...r, boardKey })));
      cursor = np.cursor;
    }
  }
  return items;
}

async function initDB() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monday_tasks (
      id          TEXT PRIMARY KEY,
      name        TEXT,
      group_title TEXT,
      board_key   TEXT,
      status      TEXT,
      priority    TEXT,
      due_date    TEXT,
      task_type   TEXT,
      synced_at   TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE monday_tasks ADD COLUMN IF NOT EXISTS task_type TEXT;
    CREATE TABLE IF NOT EXISTS syncs (
      id           SERIAL PRIMARY KEY,
      started_at   TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      item_count   INTEGER,
      error        TEXT
    );
  `);
}

async function syncAll() {
  const pool = getPool();
  const startedAt = new Date();
  const { rows: [row] } = await pool.query(
    'INSERT INTO syncs(started_at) VALUES($1) RETURNING id', [startedAt]
  );
  try {
    const [icoo1, icoo2] = await Promise.all([fetchBoardItems('icoo1'), fetchBoardItems('icoo2')]);
    const all = [...icoo1, ...icoo2];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM monday_tasks');
      const now = new Date();
      for (let i = 0; i < all.length; i += 500) {
        const chunk = all.slice(i, i + 500);
        const vals = chunk.map((_, idx) => {
          const b = idx * 9;
          return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9})`;
        }).join(',');
        const params = chunk.flatMap(r => {
          const col = id => r.column_values.find(c => c.id === id)?.text ?? null;
          return [r.id, r.name, r.group?.title??'', r.boardKey, col('status'), col('priority_Mjj6rOKH'), col('date_Mjj8FZtc')||null, col('dropdown_Mjj6ySAb'), now];
        });
        await client.query(
          `INSERT INTO monday_tasks(id,name,group_title,board_key,status,priority,due_date,task_type,synced_at) VALUES ${vals}`,
          params
        );
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
    const completedAt = new Date();
    await pool.query('UPDATE syncs SET completed_at=$1,item_count=$2 WHERE id=$3', [completedAt, all.length, row.id]);
    return { count: all.length, duration: completedAt - startedAt };
  } catch (err) {
    await pool.query('UPDATE syncs SET error=$1 WHERE id=$2', [err.message, row.id]);
    throw err;
  }
}

module.exports = { syncAll, initDB };
