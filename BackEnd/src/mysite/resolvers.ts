import { GraphQLError } from "npm:graphql";
import { ContainerModel } from "./types.ts";

async function runDockerCommand(command: string[]): Promise<string> {
    const cmd = new Deno.Command("docker", { args: command });
    const { code, stdout, stderr } = await cmd.output();
    if (code !== 0) {
        const errorText = new TextDecoder().decode(stderr);
        throw new GraphQLError(`Docker command failed: ${errorText}`);
    }
    return new TextDecoder().decode(stdout);
}

export const resolvers = {
    Query: {
        getContainers: async(
            _: unknown,
            _args: Record<string, never>,
        ): Promise<ContainerModel[]> => {
            const output = await runDockerCommand(["ps", "-a", "--format", "{{json .}}"]);
            const lines = output.trim().split('\n').filter(line => line.trim() !== '');
            const containers = lines.map(line => {
                const data = JSON.parse(line);
                return {
                    id: data.ID,
                    name: data.Names,
                    image: data.Image,
                    status: data.Status,
                    ports: data.Ports ? data.Ports.split(', ').filter(Boolean) : []
                } as ContainerModel;
            });
            return containers;
        },
        getContainer: async(
            _: unknown,
            args: {id: string},
        ): Promise<ContainerModel | null> => {
            const containers = await resolvers.Query.getContainers(_, {});
            return containers.find(c => c.id === args.id) || null;
        }
    },
    Mutation: {
        createContainer: async(
            _: unknown,
            args: {name: string, image: string},
        ): Promise<ContainerModel> => {
            // Pull image first
            await runDockerCommand(["pull", args.image]);
            // Create container
            await runDockerCommand(["create", "--name", args.name, args.image]);
            // Get the created container
            const containers = await resolvers.Query.getContainers(_, {});
            const container = containers.find(c => c.name === args.name);
            if (!container) throw new GraphQLError("Failed to create container");
            return container;
        },
        deleteContainer: async(
            _: unknown,
            args: {id: string},
        ): Promise<boolean> => {
            await runDockerCommand(["rm", args.id]);
            return true;
        },
        startContainer: async(
            _: unknown,
            args: {id: string},
        ): Promise<boolean> => {
            await runDockerCommand(["start", args.id]);
            return true;
        },
        stopContainer: async(
            _: unknown,
            args: {id: string},
        ): Promise<boolean> => {
            await runDockerCommand(["stop", args.id]);
            return true;
        }
    }
};