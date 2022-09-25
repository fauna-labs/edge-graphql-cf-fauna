import { createServer } from '@graphql-yoga/common'
import * as faunadb from "faunadb";

const q = faunadb.query as any;

let stream: any = null;
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
        onPostChange(id: ID): String
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
          const post: any = await faunaClient.query(
            q.Get(q.Ref(q.Collection("Post"), id))
          );
          return {...post.data, id};
        },
        listPosts: async () => {
          const posts: any = await faunaClient.query(
            q.Map(
              q.Paginate(q.Documents(q.Collection('Post'))),
              q.Lambda((x: any) => q.Get(x))
            )
          );
          return posts.data.map((post: any) => ({...post.data, id: post.ref.id}));
        }
      },
      Mutation: {
        addPost: async (_, { input }) => {
          return null
        },
        deletePost: async (_, { id }) => {
          return null
        },
        updatePost: async (_, { id, input }) => {
          return null
        }
      },
      Subscription: {
        onPostChange: {
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
                yield { onPostChange: JSON.stringify(newVersion.data) }
              }
            }
            await new Promise(resolve => setTimeout(resolve, 1000, null));
            stream.close();
            yield { onPostChange: 'Disconnected' }
          }
        },
      },
    },
  },
})

server.start()