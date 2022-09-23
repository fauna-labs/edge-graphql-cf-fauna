import { createServer } from '@graphql-yoga/common'

declare const EXAMPLE_KV_LOCAL: KVNamespace

const server = createServer({
  schema: {
    typeDefs: /* GraphQL */ `
      type Post {
        id: ID!
        title: String!
        content: String!
      }
      type Query {
        getPost(id: ID!): Post
        listPosts: [Post]!
      }
      type Mutation {
        addPost(input: PostInput): Post
        deletePost(id: ID): Boolean
      }
      type Subscription {
        onPostChange(id: ID): Post
      }
      input PostInput {
        id: ID
        title: String
        content: String
      }
    `,
    resolvers: {
      Query: {
        getPost: async (_, { id }) => {
          const post = await EXAMPLE_KV_LOCAL.get(id)
          console.log(post)
          if (post) {
            return JSON.parse(post)
          }
          return null;
        },
        listPosts: async () => {
          const posts = await EXAMPLE_KV_LOCAL.list();
          return posts.keys.map(key => JSON.parse(key as any))
        }
      },
      Mutation: {
        addPost: async (_, { input }) => {
          const { id, title, content } = input
          const post = { id, title, content }
          await EXAMPLE_KV_LOCAL.put(id, JSON.stringify(post))
          return post
        },
        deletePost: async (_, { id }) => {
          await EXAMPLE_KV_LOCAL.delete(id)
          return true
        }
      },
      Subscription: {
        onPostChange: {
          subscribe: async function* (_, { id }) {
            let currentVal = await EXAMPLE_KV_LOCAL.get(id);
            let subscriptionTime = 0;
            while (subscriptionTime < 100) {
              await new Promise(resolve => setTimeout(resolve, 5000, null))
              const newVal = await EXAMPLE_KV_LOCAL.get(id);
              if (newVal !== currentVal) {
                yield { onDeletePost: JSON.parse(currentVal as any) }
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