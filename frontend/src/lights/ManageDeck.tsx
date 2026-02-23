import {useEffect, useState} from "react";
import {Delete, Edit} from "@mui/icons-material";
import * as React from "react";
import "./glass.css"
import {
    addZone,
    addDeck,
    getAllDecks,
    type Deck,
    deleteDeck,
    updateDeckName,
    reorderDecks, deleteZone, updateZoneName
} from "./DeckHelper.ts";

const NEW_ZONE = "new zone";
const NEW_DECK = "new deck";

const ManageDeck: React.FC = () => {

    let [decks, setDecks] = useState<Deck[]>([]);
    const [editMode, setEditMode] = useState(false);
    const [deckForZone, setDeckForZone] = useState<Deck | null>(null);
    const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);


    const onDrag = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.dataTransfer.setData("index", index.toString());
    };

    const onDrop = async (e: React.DragEvent<HTMLDivElement>, index: number) => {
        const fromIndex = Number(e.dataTransfer.getData("index"));

        const updated = [...decks];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(index, 0, moved);
        const reNumbered = updated.map((d, i) => ({
            ...d,
            level: i + 1
        }));
        const affectedDecks = reNumbered
            .filter((d) => d.level !== decks.find(deck => deck._id === d._id)?.level)
            .map(d => ({ id: d._id, level: d.level }));
        setDecks(await reorderDecks(affectedDecks));
    };

    function updateEditMode(value: boolean): void {
        if (!value) {
            setDeckForZone(null);
        }
        setEditMode(value);
    }

    useEffect(() => {
        getAllDecks().then(r => setDecks(r))
    }, []);

    async function createDeck() {
        setDecks(await addDeck(NEW_DECK, (decks.length > 0 ? Math.max(...decks.map(d => d.level)) + 1 : 1)))
    }

    async function removeDeck(_id: string) {
        setDecks(await deleteDeck(_id));
    }

    async function changeDeckName(name: string, _id: string) {
        setDecks(await updateDeckName(name, _id))
    }


    async function changeZoneName(name: string, deckId: string, zoneId: string) {
        setDecks(await updateZoneName(name, deckId, zoneId))
    }

    async function removeZone(zoneId: string, deckId: string) {
        setDecks(await deleteZone(zoneId, deckId));
    }

    async function createZone(name: string, deckId: string) {
        setDecks(await addZone(name, deckId));
    }

    useEffect(()=> {
        function updateDeckForZone() {
            let updatedDeck = decks.find(d => d?._id === deckForZone?._id);
            if (updatedDeck !== undefined) {
                setDeckForZone(updatedDeck);
            }
        }
        updateDeckForZone();
    }, [decks])


    if (decks.length === 0) {
        return (<div>loading....</div>)
    }

    return (
        <>
            <div className="glass-container">
                <div className="glass-panel">
                    <div className="glass-title">
                        Decks
                        <Edit
                            className={`${editMode ? "selected-edit-icon" : ""}`}
                            style={{marginLeft: 10, cursor: "pointer"}}
                            onClick={() => updateEditMode(!editMode)}
                        />
                    </div>

                    {decks.map((deck) => (
                        <div
                            key={deck._id}
                            className={`list-item ${
                                selectedDeck?._id === deck._id ? "selected" : ""
                            }`}
                            onClick={() => setSelectedDeck(deck)}
                        >
                            <span>
                                {deck.level}{" "}
                                {deck.name}
                            </span>
                        </div>
                    ))}
                </div>
                {editMode && (
                    <div className="glass-panel">

                        <div className="glass-title"
                             onClick={() => createDeck()}>
                            Decks
                        </div>

                        {decks.map((deck, index) => (
                            <div className={`list-item ${deckForZone?._id === deck._id ? "selected" : ""}`}
                                 key={deck._id}>
                                <Delete
                                    style={{cursor: "pointer", color: "red"}}
                                onClick={() => removeDeck(deck._id)}/>
                                <div
                                    draggable={editMode}
                                    onDragStart={(e) => onDrag(e, index)}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={(e) => onDrop(e, index)}
                                    onClick={()=>setDeckForZone(deck)}
                                >

                                    <span>
                                        {deck.level}{" "}

                                            <input
                                                value={deck.name}
                                                onChange={e => {
                                                    const updated = decks.map(d => d.level === deck.level
                                                        ? {...d, name: e.target.value}
                                                        : d
                                                    );
                                                    setDecks(updated);
                                                }}
                                                onBlur={() => changeDeckName(deck.name, deck._id)}
                                            />
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {editMode && deckForZone && (
                    <div className="glass-panel">
                        <div className="glass-title"
                             onClick={() => {
                                 createZone(NEW_ZONE, deckForZone?._id)
                             }}>
                            Zones within deck {deckForZone?.name}
                        </div>

                        {deckForZone.zones?.map(zone => (
                            <div key={zone._id} className="list-item">
                                <Delete
                                    style={{cursor: "pointer", color: "red"}}
                                    onClick={() => removeZone(zone._id, deckForZone?._id)}
                                />
                                <input
                                    value={zone.name}
                                    onChange={e => {
                                        setDeckForZone(prevDeck => {
                                            if (!prevDeck) return prevDeck;

                                            return {
                                                ...prevDeck,
                                                zones: prevDeck.zones.map(z =>
                                                    z._id === zone._id
                                                        ? { ...z, name: e.target.value }
                                                        : z
                                                )
                                            };
                                        });
                                    }}
                                    onBlur={() => changeZoneName(zone.name, deckForZone?._id, zone._id)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default ManageDeck;
