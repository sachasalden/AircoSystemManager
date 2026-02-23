import axios from "axios";

const url = import.meta.env.VITE_API_URL;

export interface Zone {
    name: string;
    _id: string;
}

export interface Deck {
    level: number;
    name: string;
    zones: Zone[];
    _id: string;
    __v?: number;
    _level?: string;
}

export async function addZone(name: string, deckId: string): Promise<Deck[]> {
    return (await axios.put(`${url}/add/zone`,{body: {name: name, id: deckId}})).data;
}

export async function deleteZone(zoneId: string, deckId: string): Promise<Deck[]> {
    return (await axios.delete(`${url}/delete/zone/${deckId}/${zoneId}`)).data;
}

export async function getAllDecks(): Promise<Deck[]> {
    return (await axios.get('http://localhost:5001/api/collect/decks')).data;
}

export async function addDeck(name: string, level: number): Promise<Deck[]> {
    return (await axios.put(`${url}/add/deck`, {body: {name: name, level: level}})).data;
}

export async function reorderDecks(affectedDecks: any) {
    return (await axios.put(`${url}/update/deck/reorder`, {body: {affectedDecks}})).data;
}

export async function deleteDeck(id: string): Promise<Deck[]> {
    return (await axios.delete(`${url}/delete/deck/${id}`)).data;
}

export async function updateDeckName(name: string, deckId: string, ) {
    return (await axios.put(`${url}/update/deck/${deckId}`, {body: {name: name}})).data;
}

export async function updateZoneName(name: string, deckId: string, zoneId: string) {
    return (await axios.put(`${url}/update/zone/${zoneId}`, {body: {name: name, deckId: deckId}})).data;
}