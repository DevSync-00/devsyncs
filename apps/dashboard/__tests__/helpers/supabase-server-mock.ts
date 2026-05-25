export type SingleResult = { data: unknown; error: unknown }

export function createSupabaseServerMock() {
  let singleResult: SingleResult = { data: null, error: null }

  const single = jest.fn(async () => singleResult)
  const eq = jest.fn(() => ({ single }))
  const select = jest.fn(() => ({ eq }))
  const updateEq = jest.fn(async () => ({ error: null }))
  const update = jest.fn(() => ({ eq: updateEq }))
  const insertSingle = jest.fn(async () => ({ data: { id: 'history-id' }, error: null }))
  const insertSelect = jest.fn(() => ({ single: insertSingle }))
  const insert = jest.fn(() => ({ select: insertSelect }))

  const from = jest.fn(() => ({
    select,
    update,
    insert,
  }))

  const client = {
    auth: {
      getUser: jest.fn(),
    },
    from,
    rpc: jest.fn(async () => ({ data: false, error: null })),
  }

  return {
    client,
    setSingleResult: (result: SingleResult) => {
      singleResult = result
    },
    mocks: { single, eq, select, updateEq, update, insert, insertSingle, from },
  }
}
