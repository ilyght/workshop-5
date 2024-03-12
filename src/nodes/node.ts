import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { BASE_NODE_PORT } from "../config";
import { Value, NodeState } from "../types";

export type Message = {
  R: number, //node Id
  k: number,
  v: number | undefined
}

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

  let receivedMessages: Message[] = [];

  // 1.
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
  // get the current state of a node
  node.get("/getState", (req, res) => {
    return res.json(state);
  });

  // TODO implement this
  // this route allows the node to receive messages from other nodes
  node.post("/message", (req, res) => {
    if(isFaulty) {
      return res.status(500).send("faulty");
    } else{
      const message = req.body;
      receivedMessages.push(message);
      let vTotal = [];
      for (let i = 0; i< receivedMessages.length; i++)
      {
          vTotal.push(receivedMessages[i].v)
      }
      const decidedValue = getMaxOccurrence(countOccurrences(vTotal));
      state.decided = true;
      const responseMessage: Message = {
        R: nodeId,
        k: 1,
        v: decidedValue
      };
      return res.json(responseMessage);
    }
  });

  function countOccurrences<T>(list: T[]): Map<T, number> {
    const occurrences = new Map<T, number>();

    // Parcours de la liste pour compter les occurrences de chaque élément
    for (const item of list) {
      if (occurrences.has(item)) {
        occurrences.set(item, occurrences.get(item)! + 1);
      } else {
        occurrences.set(item, 1);
      }
    }

    return occurrences;
  }

  function getMaxOccurrence<T>(occurrences: Map<T, number>): T | undefined {
    let maxElement: T | undefined;
    let maxCount = -1; // Initialisation avec une valeur minimale

    for (const [element, count] of occurrences.entries()) {
      if (count > maxCount) {
        maxCount = count;
        maxElement = element;
      }
    }

    return maxElement;
  }

  // TODO implement this
  // this route is used to start the consensus algorithm
  /*node.get("/start", async (req, res) => {
    if (!nodesAreReady()) {
      return res.status(500).send("not all nodes are ready");
    } else {
      // start the consensus algorithm
      // ...
      return res.status(200).send("success");
    }
  });*/

  // TODO implement this
  // this route is used to stop the consensus algorithm
  /*node.get("/stop", async (req, res) => {
    if (!nodesAreReady()) {
      return res.status(500).send("not all nodes are ready");
    } else {
      // stop the consensus algorithm
      // ...
      return res.status(200).send("success");
    }
  });*/


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