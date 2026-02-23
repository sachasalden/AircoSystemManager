import * as React from "react";
import "../lights/glass.css"

const footer: React.FC = () => {
    return (
        <>
            <div className="bottom-nav">
                <div>Home</div>
                <div>Climate</div>
                <div>Lights</div>
                <div>Devices</div>
            </div>
        </>
    );
};

export default footer;