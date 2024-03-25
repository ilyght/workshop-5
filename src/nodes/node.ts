import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import {NodeState, Value} from "../types";

export async function node(
    nodeId: number, // the ID of the node
    N: number, // total number of nodes in the network
    F: number, // number of faulty nodes in the network
    initialValue: Value, // initial value of the node
    isFaulty: boolean, // true if the node is faulty, false otherwise
    nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
    setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
    const node = express();
    node.use(express.json());
    node.use(bodyParser.json());

    let state: NodeState = {
        killed: false,
        x: initialValue,
        decided: false,
        k: 0
    };

    let receivedMessagesP: { type: string, k: number, x: Value }[] = [];
    let receivedMessagesR: { type: string, k: number, x: Value }[] = [];


    // TODO implement this
    // this route allows retrieving the current status of the node
    node.get("/status", (req, res) => {
        if (isFaulty) {
            return res.status(500).send("faulty");
        } else {
            return res.status(200).send("live");
        }
    });

    // TODO implement this
    // this route allows the node to receive messages from other nodes
    node.post("/message", (req, res) => {
        try {
            const { k, x, type } = req.body;

            if (!isFaulty && !state.killed) {
                if (type === "R") {
                    if (!receivedMessagesP.some((proposal) => proposal.k === k)) {
                        receivedMessagesP.push({ type: type, k, x });
                    }
                    const proposal = receivedMessagesP.filter((proposal) => proposal.k === k);

                    if (proposal.length >= N - F) {
                        const count0 = proposal.filter((proposal) => proposal.x === 0).length;
                        const count1 = proposal.filter((proposal) => proposal.x === 1).length;
                        if (count0 > N / 2) {
                            state.x = 0;
                        } else if (count1 > N / 2) {
                            state.x = 1;
                        } else {
                            state.x = "?";
                        }
                        sendMessage(k, x, "P")
                    }
                } else if (type === "P") {
                    if (!receivedMessagesR.some((vote) => vote.k === k)) {
                        receivedMessagesR.push({ type: type, k, x });
                    }
                    const vote = receivedMessagesR.filter((vote) => vote.k === k);
                    if (vote.length >= N - F) {
                        const count0 = vote.filter((vote) => vote.x === 0).length;
                        const count1 = vote.filter((vote) => vote.x === 1).length;

                        if (count0 >= F + 1) {
                            state.x = 0;
                            state.decided = true;
                        } else if (count1 >= F + 1) {
                            state.x = 1;
                            state.decided = true;
                        } else {
                            if (count0 + count1 > 0 && count0 > count1) {
                                state.x = 0;
                            } else if (count0 + count1 > 0 && count0 < count1) {
                                state.x = 1;
                            } else {
                                state.x = Math.random() > 0.5 ? 0 : 1;
                            }
                            state.k = k + 1;

                            sendMessage(k, x, "R")
                        }
                    }
                }
            }
            res.status(200).send("Message received and processed.");
        } catch (error) {
            console.error("An error occurred:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    // TODO implement this
    // this route is used to start the consensus algorithm
    node.get("/start", async (req, res) => {
        if (!nodesAreReady()) {
            res.status(500).send("nodes are not ready yet");
            return;
        }

        if (isFaulty) {
            res.status(500).send("node is faulty");
            return;
        }

        state.x = initialValue;
        state.k = 0;
        state.decided = false;

        await sendMessage(state.k, state.x, "R");

        res.status(200).send("consensus started");
    });

    // TODO implement this
    // this route is used to stop the consensus algorithm
    node.get("/stop", async (req, res) => {
        state.killed = true;
        res.status(200).send(nodeId+" stopped");
    });

    // TODO implement this
    // get the current state of a node
    node.get("/getState", (req, res) => {
        return res.json(state);
    });

    async function sendMessage(k: number, x: Value, phase: string) {
        for (let i = 0; i < N; i++) {
            if (i !== nodeId) {
                await fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
                    method: "POST",
                    body: JSON.stringify({ k, x, phase }),
                });
            }
        }
    }


    // start the server
    const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
        console.log(
            `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
        );

        // the node is ready
        setNodeIsReady(nodeId);
    });

    return server;
}