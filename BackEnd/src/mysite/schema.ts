export const schema = `#graphql
type Container {
    id: ID!
    name: String!
    image: String!
    status: String!
    ports: [String!]!
}

type Query {
    getContainers: [Container!]!
    getContainer(id: ID!): Container
}

type Mutation {
    createContainer(name: String!, image: String!): Container!
    deleteContainer(id: ID!): Boolean!
    startContainer(id: ID!): Boolean!
    stopContainer(id: ID!): Boolean!
}
`;