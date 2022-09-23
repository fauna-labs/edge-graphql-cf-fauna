import { createServer } from '@graphql-yoga/common'

declare const EXAMPLE_KV_LOCAL: KVNamespace

const server = createServer({
  schema: {
    typeDefs: /* GraphQL */ `
      scalar File
      scalar JSON
      type Query {
        todoList(limit: Int = 10, cursor: String): TodoList
      }
      type Mutation {
        addTodo(id: ID, content: String, expiration: Int): ID
        deleteTodo(id: ID): Boolean
      }
      type Subscription {
        time(id: ID): String
      }
      type TodoList {
        keys: [TodoKeyInfo]
        list_complete: Boolean
        cursor: String
      }
      type TodoKeyInfo {
        name: String
        expiration: Int
        value: String
      }
    `,
    resolvers: {
      Query: {
        todoList: async (_, { limit = 10, cursor }) =>
				EXAMPLE_KV_LOCAL.list({
            limit,
            cursor,
          }),
        readFileAsText: (root, args) => EXAMPLE_KV_LOCAL.get(args.name, 'text'),
        readFileAsJson: (root, args) => EXAMPLE_KV_LOCAL.get(args.name, 'json'),
      },
      TodoKeyInfo: {
        value: ({ name }: any) => EXAMPLE_KV_LOCAL.get(name, 'text'),
      },
      Mutation: {
        addTodo: async (_, { id, content }) => {
					try {
						await EXAMPLE_KV_LOCAL.put(id, content)
          	return id
					} catch (e) {
						console.log(e)
					}
        },
        deleteTodo: (_, { id }) => {
          EXAMPLE_KV_LOCAL.delete(`${id}`)
          return true
        },
      },
      Subscription: {
        time: {
          subscribe: async function* (_, { id }) {
            let currentVal = await EXAMPLE_KV_LOCAL.get(id);
            let subscriptionTime = 0;
            while (subscriptionTime < 100) {
              await new Promise(resolve => setTimeout(resolve, 5000, null))
              const newVal = await EXAMPLE_KV_LOCAL.get(id);
              if (newVal !== currentVal) {
                yield { time: JSON.stringify({ currentVal, newVal }) }
              }
              subscriptionTime++;
            }
            yield { time: 'Disconnected' }
          }
        }
      },
    },
  },
})

server.start()