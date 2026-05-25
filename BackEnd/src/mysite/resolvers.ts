import { GraphQLError } from "npm:graphql";
import { ContainerModel } from "./types.ts";

// Map para almacenar el directorio de trabajo actual de cada contenedor y que funcione el comando cd
const containerWorkingDirs: Map<string, string> = new Map();

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
        },
        getContainerLogs: async(
            _: unknown,
            args: {id: string},
        ): Promise<string> => {
            const logs = await runDockerCommand(["logs", "--tail", "100", args.id]);
            return logs;
        },
        getContainerWorkingDir: async(
            _: unknown,
            args: {id: string},
        ): Promise<string> => {
            return containerWorkingDirs.get(args.id) || "/";
        }
    },
    Mutation: {
        createContainer: async(
            _: unknown,
            args: {name: string, image: string},
        ): Promise<ContainerModel> => {
            // Pull de la imagen
            await runDockerCommand(["pull", args.image]);

            // Imágenes que necesitan un proceso para mantenerse vivas
            const needsSleepInfinity = [
                "ubuntu",
                "debian",
                "alpine",
                "centos",
                "fedora",
                "archlinux"
            ];
            // En este caso los mismos que sleep  infinity pero listas separadas por si hubiese contenedores que necesiten uno y no otro
            const needsNetAdmin = [
                "ubuntu",
                "debian",
                "alpine",
                "centos",
                "fedora",
                "archlinux"
            ];

            const imageBase = args.image.split(':')[0].toLowerCase(); // ignora el tag ej: ubuntu:22.04 → ubuntu
            const extraArgs = needsSleepInfinity.includes(imageBase) ? ["sleep", "infinity"] : [];

            const capArgs = needsNetAdmin.includes(imageBase) ? ["--cap-add=NET_ADMIN"] : [];

            // Crear el contenedor
            await runDockerCommand(["create", "--name", args.name, ...capArgs, args.image, ...extraArgs]);

            // Si es una imagen base de Linux, hacer apt-get update al arrancar
            if (needsSleepInfinity.includes(imageBase)) {
                await runDockerCommand(["start", args.name]);
                await runDockerCommand(["exec", args.name, "apt-get", "update", "-y"]);
                await runDockerCommand(["stop", args.name]);
            }

            // Mostrar el contenedor creado
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
        },
        executeCommand: async(
            _: unknown,
            args: {id: string, command: string},
        ): Promise<{output: string, workingDir: string}> => {
            const command = args.command.trim();
            
            // Caso cuando es cd
            if (command.startsWith('cd ')) {
                // Obtener el nuevo directorio a partir del comando borrando el "cd "
                const newDir = command.substring(3).trim();
                const currentDir = containerWorkingDirs.get(args.id) || "/";
                
                // Execute cd and pwd to get the new directory
                const cdCommand = `cd "${currentDir}" && cd "${newDir}" && pwd`;
                const output = await runDockerCommand(["exec", args.id, "/bin/sh", "-c", cdCommand]);
                const newWorkingDir = output.trim();
                
                // Store the new working directory
                containerWorkingDirs.set(args.id, newWorkingDir);
                return {
                    output: `Changed directory to: ${newWorkingDir}`,
                    workingDir: newWorkingDir
                };
            }
            
            // Comando normal, se ejecuta en el directorio actual del contenedor
            const workingDir = containerWorkingDirs.get(args.id) || "/";
            const fullCommand = `cd "${workingDir}" && ${command}`;
            const output = await runDockerCommand(["exec", args.id, "/bin/sh", "-c", fullCommand]);
            return {
                output: output,
                workingDir: workingDir
            };
        },

        runAnsiblePlaybook: async(
            _: unknown,
            args: {playbook: string},
        ): Promise<{success: boolean, output: string}> => {

            const allowedPlaybooks = [
                "config_backend.yml",
                "config_frontend.yml",
                "config_externos.yml"
            ];

            if (!allowedPlaybooks.includes(args.playbook)) {
                throw new GraphQLError(`Playbook no permitido: ${args.playbook}`);
            }

            const cmd = new Deno.Command("ansible-playbook", {
                args: [
                    "-i", "/ansible/inventory.ini",
                    `/ansible/playbooks/${args.playbook}`
                ],
                env: {
                    "ANSIBLE_REMOTE_TMP": "/tmp/.ansible/tmp",
                    "DOCKER_HOST": "unix:///var/run/docker.sock"
                }
            });

            const { code, stdout, stderr } = await cmd.output();
            const stdoutText = new TextDecoder().decode(stdout);
            const stderrText = new TextDecoder().decode(stderr);
            const output = [stdoutText, stderrText].filter(t => t.trim()).join('\n');

            return {
                success: code === 0,
                output: output || `Proceso terminó con código ${code} sin salida`
            };
        }

    }
};
