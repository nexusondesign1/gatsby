const { runQuery: nodesQuery } = require(`../../db/nodes`)
const { store } = require(`../../redux`)
const { actions } = require(`../../redux/actions`)
require(`../../db/__tests__/fixtures/ensure-loki`)()

// TODO: sqlite is case insensitive; what about an object {a: 1, A: 2}

const makeNodes = () => [
  {
    id: `0`,
    internal: { type: `Test`, contentDigest: `0` },
    index: 0,
    name: `The Mad Max`,
    string: `a`,
    float: 1.5,
    hair: 1,
    date: `2006-07-22T22:39:53.000Z`,
    anArray: [1, 2, 3, 4],
    strArray: '["testing", "serialization", "hacks"]',
    nullArray: [1, null, 3, 4],
    key: {
      withEmptyArray: [],
    },
    anotherKey: {
      withANested: {
        nestedKey: `foo`,
        emptyArray: [],
        anotherEmptyArray: [],
      },
    },
    frontmatter: {
      date: `2006-07-22T22:39:53.000Z`,
      title: `The world of dash and adventure`,
      tags: [`moo`, `foo`],
      blue: 100,
    },
    anObjectArray: [
      { aString: `some string`, aNumber: 2, aBoolean: true },
      { aString: `some string`, aNumber: 2, anArray: [1, 2] },
    ],
    boolean: true,
    nil: "not null",
    nestedRegex: {
      field: `har har`,
    },
  },
  {
    id: `1`,
    internal: { type: `Test`, contentDigest: `0` },
    index: 1,
    name: `The Mad Wax`,
    string: `b`,
    float: 2.5,
    hair: 2,
    anArray: [1, 2, 5, 4],
    strArray: "[5,6,7,8]",
    nullArray: [1, 3, 4],
    waxOnly: {
      foo: true,
      bar: { baz: true },
    },
    anotherKey: {
      withANested: {
        nestedKey: `foo`,
      },
    },
    frontmatter: {
      date: `2006-07-22T22:39:53.000Z`,
      title: `The world of slash and adventure`,
      blue: 10010,
      circle: `happy`,
    },
    boolean: false,
    nil: null,
    undef: undefined,
    singleElem: {
      things: [
        {
          one: {
            two: {
              three: 123,
            },
          },
        },
        {
          one: {
            five: {
              three: 153,
            },
          },
        },
        {
          one: {
            two: {
              three: 404,
            },
          },
        },
      ],
    },
    nestedRegex: {
      field: ``,
    },
    strSecondOnly: 'needle',
    boolSecondOnly: false,
  },
  {
    id: `2`,
    internal: { type: `Test`, contentDigest: `0` },
    index: 2,
    name: `The Mad Wax`,
    string: `c`,
    float: 3.5,
    hair: 0,
    date: `2006-07-29T22:39:53.000Z`,
    waxOnly: null,
    anotherKey: {
      withANested: {
        nestedKey: `bar`,
      },
    },
    frontmatter: {
      date: `2006-07-22T22:39:53.000Z`,
      title: `The world of shave and adventure`,
      blue: 10010,
      circle: `happy`,
    },
    data: {
      tags: [
        {
          tag: {
            document: [
              {
                data: {
                  tag: `Gatsby`,
                },
              },
            ],
          },
        },
        {
          tag: {
            document: [
              {
                data: {
                  tag: `Design System`,
                },
                number: 5,
              },
            ],
          },
        },
      ],
    },
  },
]

function makeGqlType(nodes) {
  const { createSchemaComposer } = require(`../../schema/schema-composer`)
  const { addInferredFields } = require(`../infer/add-inferred-fields`)
  const { addNodes } = require(`../infer/inference-metadata`)
  const { getExampleObject } = require(`../infer/build-example-data`)

  const sc = createSchemaComposer()
  const typeName = `Test`
  const tc = sc.createObjectTC(typeName)
  const inferenceMetadata = addNodes({ typeName }, nodes)
  addInferredFields({
    schemaComposer: sc,
    typeComposer: tc,
    exampleValue: getExampleObject(inferenceMetadata),
  })
  return { sc, type: tc.getType() }
}

function resetDb(nodes) {
  store.dispatch({ type: `DELETE_CACHE` })
  nodes.forEach(node =>
    actions.createNode(node, { name: `test` })(store.dispatch)
  )
}

async function runQuery(queryArgs) {
  console.debug(
    "\n" +
      "\n#####################################\n" +
      "\n#########  runQuery  ################\n" +
      "\n#####################################\n" +
      "\n"
  )

  const nodes = makeNodes()
  resetDb(nodes)
  const { sc, type: gqlType } = makeGqlType(nodes)
  const args = {
    gqlType,
    firstOnly: false,
    queryArgs,
    gqlComposer: sc,
    nodeTypeNames: [gqlType.name],
  }
  console.debug(
    "\n" +
      "\n#####################################\n" +
      "\n#########  start  ################\n" +
      "\n#####################################\n" +
      "\n"
  )
  return await nodesQuery(args)
}

async function runFilter(filter) {
  return await runQuery({ filter })
}

describe(`Filter fields`, () => {
  it(`handles eq operator`, async () => {
    let result = await runFilter({ hair: { eq: 2 } })

    expect(result.length).toEqual(1)
    expect(result[0].hair).toEqual(2)
  })

  it(`handles eq operator with false value`, async () => {
    let result = await runFilter({ boolean: { eq: false } })

    expect(result.length).toEqual(1)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`handles eq operator with 0`, async () => {
    let result = await runFilter({ hair: { eq: 0 } })

    expect(result.length).toEqual(1)
    expect(result[0].hair).toEqual(0)
  })

  it(`handles eq operator with null`, async () => {
    let result = await runFilter({ nil: { eq: null } })

    // Also return nodes that do not have the property at all (NULL in db)
    expect(result.length).toEqual(2)
  })

  // grapqhl would never pass on `undefined`
  // it(`handles eq operator with undefined`, async () => {
  //   let result = await runFilter({ undef: { eq: undefined } })
  //
  //   expect(result.length).toEqual(?)
  //   expect(result[0].hair).toEqual(?)
  // })

  it(`handles eq operator with serialized array value`, async () => {
    let result = await runFilter({ strArray: { eq: "[5,6,7,8]" } })

    expect(result.length).toEqual(1)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`handles ne operator`, async () => {
    let result = await runFilter({ hair: { ne: 2 } })

    expect(result.length).toEqual(2)
    expect(result[0].hair).toEqual(1)
  })

  it(`handles ne: true operator`, async () => {
    let result = await runFilter({ boolean: { ne: true } })

    expect(result.length).toEqual(2)
  })

  it(`handles nested ne: true operator`, async () => {
    let result = await runFilter({ waxOnly: { foo: { ne: true } } })

    expect(result.length).toEqual(2)
  })

  it(`handles ne operator with 0`, async () => {
    let result = await runFilter({ hair: { ne: 0 } })

    expect(result.length).toEqual(2)
  })

  it(`handles ne operator with null`, async () => {
    let result = await runFilter({ nil: { ne: null } })

    // Should only return nodes who do have the property, not set to null
    expect(result.length).toEqual(1)
    expect(result[0].name).toEqual("The Mad Max")
  })

  // grapqhl would never pass on `undefined`
  // it(`handles ne operator with undefined`, async () => {
  //   let result = await runFilter({ undef: { ne: undefined } })
  //
  //   expect(result.length).toEqual(?)
  // })

  it(`handles deeply nested ne: true operator`, async () => {
    let result = await runFilter({
      waxOnly: { bar: { baz: { ne: true } } },
    })

    expect(result.length).toEqual(2)
  })

  it(`handles lt operator with number`, async () => {
    let result = await runFilter({ hair: { lt: 2 } })

    expect(result.length).toEqual(2)
    expect(result[0].hair).toEqual(1)
    expect(result[1].hair).toEqual(0)
  })

  it(`handles lt operator with null`, async () => {
    let result = await runFilter({ nil: { lt: null } })

    // Nothing is lt null
    expect(result).toEqual(null)
  })

  it(`handles lte operator with number`, async () => {
    let result = await runFilter({ hair: { lte: 1 } })

    expect(result.length).toEqual(2)
    expect(result[0].hair).toEqual(1)
    expect(result[1].hair).toEqual(0)
  })

  it(`handles lte operator with null`, async () => {
    let result = await runFilter({ nil: { lte: null } })

    // lte null matches null but no nodes without the property (NULL)
    expect(result.length).toEqual(1)
    expect(result[0].name).toEqual(`The Mad Wax`)
    expect(result[0].nil).toEqual(null)
  })

  it(`handles gt operator with number`, async () => {
    let result = await runFilter({ hair: { gt: 0 } })

    expect(result.length).toEqual(2)
    expect(result[0].hair).toEqual(1)
    expect(result[1].hair).toEqual(2)
  })

  it(`handles gt operator with null`, async () => {
    let result = await runFilter({ nil: { gt: null } })

    // Nothing is gt null
    expect(result).toEqual(null)
  })

  it(`handles gte operator with number`, async () => {
    let result = await runFilter({ hair: { gte: 1 } })

    expect(result.length).toEqual(2)
    expect(result[0].hair).toEqual(1)
    expect(result[1].hair).toEqual(2)
  })

  it(`handles gte operator with null`, async () => {
    let result = await runFilter({ nil: { gte: null } })

    // lte null matches null but no nodes without the property (NULL)
    expect(result.length).toEqual(1)
    expect(result[0].name).toEqual(`The Mad Wax`)
    expect(result[0].nil).toEqual(null)
  })

  it(`handles the regex operator without flags`, async () => {
    let result = await runFilter({ name: { regex: `/^The.*Wax/` } })

    expect(result.length).toEqual(2)
    expect(result[0].name).toEqual(`The Mad Wax`)
    expect(result[1].name).toEqual(`The Mad Wax`)
  })

  it(`handles the regex operator with i-flag`, async () => {
    let result = await runFilter({ name: { regex: `/^the.*wax/i` } })

    expect(result.length).toEqual(2)
    expect(result[0].name).toEqual(`The Mad Wax`)
    expect(result[1].name).toEqual(`The Mad Wax`)
  })

  it(`handles the nested regex operator`, async () => {
    let result = await runFilter({ nestedRegex: { field: { regex: `/.*/` } } })

    expect(result.length).toEqual(2)
    expect(result[0].id).toEqual(`0`)
    expect(result[1].id).toEqual(`1`)
  })

  it(`does not match double quote for string without it`, async () => {
    // Strings are encoded in the db with a double quote as prefix
    // When regex comparing against strings, make sure to unbox the value first
    let result = await runFilter({ name: { regex: `/"/` } })

    // This test fails if the underwater encoding is not properly applied or
    // unboxed. None of the names contain a double quote.
    expect(result).toEqual(null)
  })

  it(`handles the in operator for strings`, async () => {
    let result = await runFilter({ string: { in: [`b`, `c`] } })

    expect(result.length).toEqual(2)
    expect(result[0].index).toEqual(1)
  })

  it(`handles the in operator for ints`, async () => {
    let result = await runFilter({ index: { in: [0, 2] } })

    expect(result.length).toEqual(2)
    expect(result[0].index).toEqual(0)
    expect(result[1].index).toEqual(2)
  })

  it(`handles the in operator for floats`, async () => {
    let result = await runFilter({ float: { in: [1.5, 2.5] } })

    expect(result.length).toEqual(2)
    expect(result[0].index).toEqual(0)
    expect(result[1].index).toEqual(1)
  })

  it(`handles the in operator for just null`, async () => {
    let result = await runFilter({ nil: { in: [null] } })

    // Do not include the nodes without a `nil` property
    expect(result.length).toEqual(2)
    result.forEach(edge => {
      // May not have the property, or must be null
      expect(edge.nil === undefined || edge.nil === null).toBe(true)
    })
  })

  it(`handles the in operator for double null`, async () => {
    let result = await runFilter({ nil: { in: [null, null] } })

    // Do not include the nodes without a `nil` property
    expect(result.length).toEqual(2)
    result.forEach(edge => {
      // May not have the property, or must be null
      expect(edge.nil === undefined || edge.nil === null).toBe(true)
    })
  })

  it(`handles the in operator for null in int and null`, async () => {
    let result = await runFilter({ nil: { in: [5, null] } })

    // Include the nodes without a `nil` property
    expect(result.length).toEqual(2)
    result.forEach(edge => {
      // May not have the property, or must be null
      expect(edge.nil === undefined || edge.nil === null).toBe(true)
    })
  })

  it(`handles the in operator for int in int and null`, async () => {
    let result = await runFilter({ index: { in: [2, null] } })

    // Include the nodes without a `index` property (there aren't any)
    expect(result.length).toEqual(1)
    result.forEach(edge => {
      expect(edge.index === 2).toBe(true)
    })
  })

  it(`handles the in operator for booleans`, async () => {
    let result = await runFilter({ boolean: { in: [true] } })

    expect(result.length).toEqual(1)
    expect(result[0].index).toEqual(0)
    expect(result[0].boolean).toEqual(true)
  })

  it(`handles the in operator for array with one element`, async () => {
    let result = await runFilter({ anArray: { in: [5] } })

    // The first one has a 5, the second one does not have a 5, the third does
    // not have the property at all (NULL). It should return the first and last.
    // (If the target value has `null` then the third should be omitted)
    expect(result.length).toEqual(1)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`handles the in operator for array some elements`, async () => {
    let result = await runFilter({ anArray: { in: [20, 5, 300] } })

    // Same as the test for just `[5]`. 20 and 300 do not appear anywhere.
    expect(result.length).toEqual(1)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`handles the nested in operator for array of strings`, async () => {
    let result = await runFilter({ frontmatter: { tags: { in: [`moo`] } } })

    expect(result.length).toEqual(1)
    expect(result[0].name).toEqual("The Mad Max")
  })

  it(`handles the elemMatch operator on a proper single tree`, async () => {
    let result = await runFilter({
      singleElem: {
        things: {
          elemMatch: {
            one: {
              two: {
                three: { eq: 123 },
              },
            },
          },
        },
      },
    })

    expect(result.length).toEqual(1)
  })

  it(`handles the elemMatch operator on the second element`, async () => {
    let result = await runFilter({
      singleElem: {
        things: {
          elemMatch: {
            one: {
              five: {
                three: { eq: 153 },
              },
            },
          },
        },
      },
    })

    expect(result.length).toEqual(1)
    // Should contain the entire array even only one matched
    expect(result[0].singleElem.things[0].one.two.three).toEqual(123)
    expect(result[0].singleElem.things[1].one.five.three).toEqual(153)
  })

  it(`should return only one node if elemMatch hits multiples`, async () => {
    let result = await runFilter({
      singleElem: {
        things: {
          elemMatch: {
            one: {
              two: {
                three: { lt: 1000 }, // one match is 123, the other 404
              },
            },
          },
        },
      },
    })

    // The `elemMatch` operator only returns the first nodde that matches so
    // even though the `lt 1000` would match two elements in the `things` array
    // it will return one node.
    expect(result.length).toEqual(1)
    expect(result[0].singleElem.things[0].one.two.three).toEqual(123)
    expect(result[0].singleElem.things[2].one.two.three).toEqual(404)
  })

  it(`ignores the elemMatch operator on a partial sub tree`, async () => {
    let result = await runFilter({
      singleElem: {
        things: {
          elemMatch: {
            three: { eq: 123 },
          },
        },
      },
    })

    expect(result).toEqual(null)
  })

  it(`handles the elemMatch operator for array of objects (1)`, async () => {
    let result = await runFilter({
      data: {
        tags: {
          elemMatch: {
            tag: {
              document: {
                elemMatch: {
                  data: {
                    tag: { eq: `Gatsby` },
                  },
                },
              },
            },
          },
        },
      },
    })

    expect(result.length).toEqual(1)
    expect(result[0].index).toEqual(2)
  })

  it(`handles the elemMatch operator for array of objects (2)`, async () => {
    let result = await runFilter({
      data: {
        tags: {
          elemMatch: {
            tag: {
              document: {
                elemMatch: {
                  data: {
                    tag: { eq: `Design System` },
                  },
                },
              },
            },
          },
        },
      },
    })

    expect(result.length).toEqual(1)
    expect(result[0].index).toEqual(2)
  })

  it(`works for elemMatch on boolean field`, async () => {
    let result = await runFilter({
      boolean: {
        elemMatch: {
          eq: true,
        },
      },
    })

    // Does NOT contain nodes that do not have the field
    expect(result.length).toEqual(1)
    expect(result[0].boolean).toEqual(true)
  })

  it(`skips nodes without the field for elemMatch on boolean`, async () => {
    let result = await runFilter({
      boolSecondOnly: {
        elemMatch: {
          eq: false,
        },
      },
    })

    // Does NOT contain nodes that do not have the field so returns 2nd node
    expect(result.length).toEqual(1)
    expect(result[0].boolSecondOnly).toEqual(false)
  })

  it(`works for elemMatch on string field`, async () => {
    let result = await runFilter({
      string: {
        elemMatch: {
          eq: 'a',
        },
      },
    })

    // Does NOT contain nodes that do not have the field
    expect(result.length).toEqual(1)
    expect(result[0].string).toEqual('a')
  })

  it(`should return all nodes for elemMatch on non-arrays too`, async () => {
    let result = await runFilter({
      name: {
        elemMatch: {
          eq: 'The Mad Wax',
        },
      },
    })

    // Can return more than one node
    // Does NOT contain nodes that do not have the field
    expect(result.length).toEqual(2)
    expect(result[0].name).toEqual('The Mad Wax')
    expect(result[1].name).toEqual('The Mad Wax')
  })

  it(`skips nodes without the field for elemMatch on string`, async () => {
    let result = await runFilter({
      strSecondOnly: {
        elemMatch: {
          eq: 'needle',
        },
      },
    })

    // Does NOT contain nodes that do not have the field so returns 2nd node
    expect(result.length).toEqual(1)
    expect(result[0].strSecondOnly).toEqual('needle')
  })

  it(`works for elemMatch on number field`, async () => {
    let result = await runFilter({
      float: {
        elemMatch: {
          eq: 1.5,
        },
      },
    })

    // Does NOT contain nodes that do not have the field
    expect(result.length).toEqual(1)
    expect(result[0].float).toEqual(1.5)
  })

  it(`handles the nin operator for array [5]`, async () => {
    let result = await runFilter({ anArray: { nin: [5] } })

    // Since the array does not contain `null`, the query should also return the
    // nodes that do not have the field at all (NULL).

    expect(result.length).toEqual(2)
    result.forEach(edge => {
      // Either does not exist or does not contain
      expect(edge.anArray === undefined || !edge.anArray.includes(5)).toBe(true)
    })
  })

  it(`handles the nin operator for array [null]`, async () => {
    let result = await runFilter({ nullArray: { nin: [null] } })

    // Since the array contains `null`, the query should NOT return the
    // nodes that do not have the field at all (NULL).

    expect(result.length).toEqual(1)
    expect(result[0].nullArray.includes(null)).toBe(false)
  })

  it(`handles the nin operator for strings`, async () => {
    let result = await runFilter({ string: { nin: [`b`, `c`] } })

    expect(result.length).toEqual(1)
    result.forEach(edge => {
      expect(edge.string).not.toEqual(`b`)
      expect(edge.string).not.toEqual(`c`)
    })
  })

  it(`handles the nin operator for ints`, async () => {
    let result = await runFilter({ index: { nin: [0, 2] } })

    expect(result.length).toEqual(1)
    result.forEach(edge => {
      expect(edge.index).not.toEqual(0)
      expect(edge.index).not.toEqual(2)
    })
  })

  it(`handles the nin operator for floats`, async () => {
    let result = await runFilter({ float: { nin: [1.5] } })

    expect(result.length).toEqual(2)
    result.forEach(edge => {
      // Might not have the property (-> undefined), must not be 1.5
      expect(edge.float).not.toEqual(1.5)
    })
  })

  it(`handles the nin operator for booleans`, async () => {
    let result = await runFilter({ boolean: { nin: [true, null] } })

    // Do not return the node that does not have the field because of `null`
    expect(result.length).toEqual(1)
    result.forEach(edge => {
      // Must have the property, must not be true nor null
      expect(edge.boolean !== undefined).toBe(true)
      expect(edge.boolean !== true && edge.boolean !== null).toBe(true)
    })
  })

  it(`handles the nin operator for double null`, async () => {
    let result = await runFilter({ nil: { nin: [null, null] } })

    // Do not return the node that does not have the field because of `null`
    expect(result.length).toEqual(1)
    result.forEach(edge => {
      // Must have the property, must not be null
      expect(edge.nil !== undefined).toBe(true)
      expect(edge.nil !== null).toBe(true)
    })
  })

  it(`handles the nin operator for null in int+null`, async () => {
    let result = await runFilter({ nil: { nin: [5, null] } })

    // Do not return the node that does not have the field because of `null`
    expect(result.length).toEqual(1)
    result.forEach(edge => {
      // Must have the property, must not be 5 nor null
      expect(edge.nil !== undefined).toBe(true)
      expect(edge.nil !== 5 && edge.nil !== null).toBe(true)
    })
  })

  it(`handles the nin operator for int in int+null`, async () => {
    let result = await runFilter({ index: { nin: [2, null] } })

    // Do not return the node that does not have the field because of `null`
    expect(result.length).toEqual(2)
    result.forEach(edge => {
      // Must have the property, must not be 2 nor null
      expect(edge.index !== undefined).toBe(true)
      expect(edge.index !== 2 && edge.index !== null).toBe(true)
    })
  })

  it(`handles the glob operator`, async () => {
    let result = await runFilter({ name: { glob: `*Wax` } })

    expect(result.length).toEqual(2)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`filters date fields`, async () => {
    let result = await runFilter({ date: { ne: null } })

    expect(result.length).toEqual(2)
    expect(result[0].index).toEqual(0)
    expect(result[1].index).toEqual(2)
  })

  it(`handles the eq operator for array field values`, async () => {
    const result = await runFilter({ anArray: { eq: 5 } })

    expect(result.length).toBe(1)
    expect(result[0].index).toBe(1)
  })

  it(`handles the ne operator for array field values`, async () => {
    const result = await runFilter({ anArray: { ne: 1 } })

    expect(result.length).toBe(1)
    expect(result[0].index).toBe(2)
  })
})

describe(`collection fields`, () => {
  it(`sorts results`, async () => {
    let result = await runQuery({
      limit: 10,
      sort: {
        fields: [`frontmatter.blue`],
        order: [`desc`],
      },
    })

    expect(result.length).toEqual(3)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`sorts results with desc has null fields first`, async () => {
    let result = await runQuery({
      limit: 10,
      sort: {
        fields: [`waxOnly`],
        order: [`desc`],
      },
    })

    expect(result.length).toEqual(3)
    expect(result[0].id).toEqual(`0`)
    expect(result[1].id).toEqual(`2`)
    expect(result[2].id).toEqual(`1`)
  })

  it(`sorts results with asc has null fields last`, async () => {
    let result = await runQuery({
      limit: 10,
      sort: {
        fields: [`waxOnly`],
        order: [`asc`],
      },
    })

    expect(result.length).toEqual(3)
    expect(result[0].id).toEqual(`1`)
    expect(result[1].id).toEqual(`2`)
    expect(result[2].id).toEqual(`0`)
  })

  it(`applies specified sort order, and sorts asc by default`, async () => {
    let result = await runQuery({
      limit: 10,
      sort: {
        fields: [`frontmatter.blue`, `id`],
        order: [`desc`], // `id` field will be sorted asc
      },
    })

    expect(result.length).toEqual(3)
    expect(result[0].id).toEqual(`1`) // blue = 10010, id = 1
    expect(result[1].id).toEqual(`2`) // blue = 10010, id = 2
    expect(result[2].id).toEqual(`0`) // blue = 100, id = 0
  })

  it(`applies specified sort order per field`, async () => {
    let result = await runQuery({
      limit: 10,
      sort: {
        fields: [`frontmatter.blue`, `id`],
        order: [`desc`, `desc`], // `id` field will be sorted desc
      },
    })

    expect(result.length).toEqual(3)
    expect(result[0].id).toEqual(`2`) // blue = 10010, id = 2
    expect(result[1].id).toEqual(`1`) // blue = 10010, id = 1
    expect(result[2].id).toEqual(`0`) // blue = 100, id = 0
  })
})
