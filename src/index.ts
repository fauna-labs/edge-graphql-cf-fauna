import { createServer } from '@graphql-yoga/common'
import { faunaClient, q } from './db'

let stream: any = null;

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
          const post: any = await faunaClient.query(
            q.Create(q.Collection("Post"), { data: input })
          );
          return {...post.data, id: post.ref.id};
        },
        deletePost: async (_, { id }) => {
          await faunaClient.query(
            q.Delete(q.Ref(q.Collection("Post"), id))
          );
          return true;
        },
        updatePost: async (_, { id, input }) => {
          const post: any = await faunaClient.query(
            q.Update(q.Ref(q.Collection("Post"), id), { data: input })
          );
          return {...post.data, id};
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