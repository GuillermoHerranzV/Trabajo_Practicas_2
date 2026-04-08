import { ApolloServer } from "npm:@apollo/server";
import { startStandaloneServer } from "npm:@apollo/server/standalone";

import { schema } from "./schema.ts";
import { resolvers } from "./resolvers.ts";
//import { Context } from "./context.ts";

const server = new ApolloServer({
  typeDefs: schema,
  resolvers: resolvers,
});

const port = parseInt(Deno.env.get("PORT") || "8000");

const { url } = await startStandaloneServer(server, {
  listen: { port },
  context: async () => ({}),
});

console.log(`Server running on: ${url}`);