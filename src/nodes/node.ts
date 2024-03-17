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
        let {type, k , x } = req.body;

        if (state.killed || isFaulty)
        {
            res.status(500).send("node not working")
        }
        else {
            if(type == "P")
            {
                receivedMessagesP.push({type, k, x})
                let {maxElement, maxCount} = getMaxOccurrence(receivedMessagesP);
                if (maxCount >= F+1 && maxElement != "?"){
                    state.decided = true
                    state.x = maxElement
                }
                else{
                    state.x = Math.random() > 0.5 ? 0 : 1;
                }
            }
            if(type == "R")
            {
                receivedMessagesR.push({type, k, x})
                let {maxElement, maxCount} = getMaxOccurrence(receivedMessagesR);
                if (maxCount >= N/2 ){
                    sendMessage(k, x, type)
                }
                else{
                    sendMessage(k, "?", type)
                }
            }
        }
        state.k=k+1;
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


    function getMaxOccurrence<Value>(messages: { type: string, k: number, x: Value }[]): { maxElement: Value | null; maxCount: number } {
        const occurrences = new Map<Value, number>();

        // Compter les occurrences de chaque élément
        messages.forEach(message => {
            const element = message.x;
            occurrences.set(element, (occurrences.get(element) || 0) + 1);
        });

        // Trouver l'élément avec le plus d'occurrences
        let maxElement: Value | null;
        let maxCount = -1; // Initialisation avec une valeur minimale

        for (const [element, count] of occurrences.entries()) {
            if (count > maxCount) {
                maxCount = count;
                maxElement = element;
            }
        }

        // @ts-ignore
        return { maxElement, maxCount };
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