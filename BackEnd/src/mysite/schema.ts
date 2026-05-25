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
    getContainerLogs(id: ID!): String!
    getContainerWorkingDir(id: ID!): String!
}

type Mutation {
    createContainer(name: String!, image: String!): Container!
    deleteContainer(id: ID!): Boolean!
    startContainer(id: ID!): Boolean!
    stopContainer(id: ID!): Boolean!
    executeCommand(id: ID!, command: String!): CommandResult!
    runAnsiblePlaybook(playbook: String!): AnsibleResult!
}

type CommandResult {
    output: String!
    workingDir: String!
}

type AnsibleResult {
    success: Boolean!
    output: String!
}

`;