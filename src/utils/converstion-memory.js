import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";

const historySessions = new Map();

export function getSessionHistory(sessionId){
    if(!historySessions.get(sessionId)){
        historySessions.set(sessionId, new InMemoryChatMessageHistory());
    }
    return historySessions.get(sessionId);
}

export function deleteSessionHistory(sessionId){
    return historySessions.delete(sessionId);
}