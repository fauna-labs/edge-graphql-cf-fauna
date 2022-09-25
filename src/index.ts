import { createServer } from '@graphql-yoga/common'
import * as faunadb from "faunadb";

const q = faunadb.query as any;

let stream: any = null;
declare const EXAMPLE_KV_LOCAL: KVNamespace
declare const FAUNA_DOMAIN: string;
declare const FAUNA_SECRET: string;


const faunaClient = new faunadb.Client({ 
  domain: FAUNA_DOMAIN,
  secret: FAUNA_SECRET,
});

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
        updatePost(id: ID, input: PostInput): Post
      }
      type Subscription {
        onPostChange(id: ID): Post
        onTest(id: ID): String
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
          if (post) {
            return JSON.parse(post)
          }
          return null;
        },
        listPosts: async () => {
          const result = [];
          const kvStore = await EXAMPLE_KV_LOCAL.list();
          for await (const key of kvStore.keys) {
            const val = await EXAMPLE_KV_LOCAL.get(key.name)
            if(val) {
              result.push(JSON.parse(val))
            }
          }
          return result;
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
        },
        updatePost: async (_, { id, input }) => {
          const post = await EXAMPLE_KV_LOCAL.get(id)
          if (post) {
            const newPost = { 
              ...JSON.parse(post), 
              ...input
            }
            await EXAMPLE_KV_LOCAL.put(id, JSON.stringify(newPost))
            return newPost
          }
          return null
        }
      },
      Subscription: {
        onTest: {
          subscribe: async function* (_, { id }) {
            let currentSnap: any;
            let newVersion: any;
            const docRef = q.Ref(q.Collection('Post'), '343010020423630924');
            if(!stream) {
              stream = faunaClient.stream.document(docRef).on('snapshot', (snapshot: any) => {
                currentSnap = {
                  ts: snapshot.ts,
                  data: snapshot.data
                }
              }).start();
            } 
            stream.on('version', (version: any) => {
              newVersion = {
                ts: version.document.ts,
                data: version.document.data
              }
            });

            let subscriptionTime = 0; // Terminate Subscription after 1000 seconds
            
            while (subscriptionTime < 200) {
              await new Promise(resolve => setTimeout(resolve, 2000, null));
              subscriptionTime++;
              if(newVersion && newVersion.ts !== currentSnap.ts) {
                currentSnap = newVersion;
                yield { onTest: JSON.stringify(newVersion.data) }
              }
            }
            yield { onTest: 'Disconnected' }
          }
        },
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