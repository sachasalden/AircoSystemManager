import "./App.css";
import 'materialize-css/dist/css/materialize.min.css';
import {
    BrowserRouter as Router,
    Routes,
    Route,
} from "react-router-dom";
import Footer from "./assets/Footer.tsx";
import Climate from './Airco/Climate.tsx';

function App() {
    return (
        <div className="app-background">
            <main className="flex-grow" style={{ flex: 1 }}>
                <Router>
                    <Routes>
                        <Route path="/" element={<Climate />} />
                    </Routes>
                </Router>
            </main>

            <footer className="">
                <Footer/>
            </footer>
        </div>
    );
}

export default App;
