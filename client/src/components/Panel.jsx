import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
    ShoppingBag, Package, Tag, Globe, Settings, Zap, Menu, X, Plus, Key, LogOut, Trash2
} from 'lucide-react';
import { ItemCard } from './ItemCards';

const API_URL = "http://localhost:3000";

// --- AUTHENTICATION SCREEN ---
function AuthScreen({ onAuthSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const endpoint = isLogin ? '/api/login' : '/api/register';

        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.userId);
            onAuthSuccess(data.userId);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white font-sans p-4">
            <div className="w-full max-w-md p-8 border rounded-2xl border-neutral-800 bg-neutral-900/50 backdrop-blur-xl">
                <div className="flex flex-col items-center gap-3 mb-8">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-linear-to-br from-teal-400 to-teal-600 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                        <Zap className="w-6 h-6 text-white fill-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-wide">qzdzqd<span className="text-teal-500">qzdzqd</span></h1>
                    <p className="text-sm text-neutral-400">{isLogin ? 'Welcome back' : 'Create your account'}</p>
                </div>

                {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-500/10 rounded-xl">{error}</div>}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block mb-2 text-sm font-medium text-neutral-400">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 text-white border rounded-xl border-neutral-700 bg-neutral-950 placeholder:text-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-medium text-neutral-400">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 text-white border rounded-xl border-neutral-700 bg-neutral-950 placeholder:text-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            required
                        />
                    </div>
                    <button type="submit" className="w-full py-3 mt-2 font-medium text-white transition-colors bg-teal-600 rounded-xl hover:bg-teal-500">
                        {isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>

                <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="w-full mt-4 text-sm text-center text-neutral-500 hover:text-white transition-colors"
                >
                    {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
            </div>
        </div>
    );
}

// --- MAIN DASHBOARD SCREEN ---
function Dashboard({ userId, onLogout }) {
    const [activeTab, setActiveTab] = useState('Vinted');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [newSearchName, setNewSearchName] = useState('');
    const [cookieInput, setCookieInput] = useState('');

    const deleteKeyword = async (id) => {
        try {
            const res = await fetch(`${API_URL}/api/keywords/${id}?userId=${userId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setWatchlist(prev => prev.filter(kw => kw.id !== id));
            }
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    const platforms = [
        { name: 'Vinted', icon: ShoppingBag },
        { name: 'Others', icon: Globe },
    ];

    // Establish dynamic Socket connection
    useEffect(() => {
        const socket = io(API_URL, { query: { userId } });

        socket.on('new-item', (newItem) => {
            setItems((prevItems) => {
                if (prevItems.find(i => i.id === newItem.id)) return prevItems;
                return [newItem, ...prevItems];
            });

            if (Notification.permission === "granted") {
                new Notification(`New Drop!`, { body: `${newItem.title} - ${newItem.price}€` });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        });

        return () => socket.disconnect();
    }, [userId]);

    // Fetch initial data
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const kwRes = await fetch(`${API_URL}/api/keywords/${userId}`);
                setWatchlist(await kwRes.json());

                const itemsRes = await fetch(`${API_URL}/api/items/${userId}`);
                const itemsData = await itemsRes.json();

                setItems(itemsData.map(dbItem => ({
                    id: dbItem.id,
                    title: dbItem.title,
                    price: dbItem.price,
                    url: dbItem.url,
                    imageUrl: dbItem.image_url,
                    brand: dbItem.brand,
                    size: dbItem.size,
                    platform: dbItem.platform
                })));
            } catch (err) {
                console.error("Failed to fetch initial data", err);
            }
        };
        fetchInitialData();
    }, [userId]);

    const handleSaveCookie = async (e) => {
        e.preventDefault();
        try {
            await fetch(`${API_URL}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, cookie: cookieInput })
            });
            alert('Cookie saved securely!');
            setCookieInput('');
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddKeyword = async (e) => {
        e.preventDefault();
        const trimmedName = newSearchName.trim();
        if (!trimmedName) return;

        try {
            const res = await fetch(`${API_URL}/api/keywords`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, keyword: trimmedName })
            });

            if (res.ok) {
                const newKeyword = await res.json();
                setWatchlist([...watchlist, newKeyword]);
                setNewSearchName('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const filteredItems = items.filter(item => item.platform === activeTab);

    return (
        <div className="flex w-full h-screen font-sans overflow-hidden bg-neutral-950 text-neutral-200">
            {/* Mobile Header */}
            <div className="fixed top-0 z-50 flex items-center justify-between w-full px-4 py-3 border-b md:hidden border-neutral-800 bg-neutral-900">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-teal-500" />
                    <span className="font-bold text-white">FinderPro</span>
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-neutral-400 hover:text-white">
                    {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-neutral-800 bg-neutral-900/95 backdrop-blur-xl transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex items-center justify-between hidden px-6 border-b h-16 md:flex border-neutral-800/60 md:h-20">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-linear-to-br from-teal-400 to-teal-600 shadow-[0_0_15px_rgba(20,184,166,0.3)] md:h-10 md:w-10">
                            <Zap className="w-4 h-4 text-white fill-white md:h-5 md:w-5" />
                        </div>
                        <span className="text-lg font-bold tracking-wide text-white md:text-xl">
                            qzdqzd<span className="text-teal-500">qzdzqd</span>
                        </span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar">
                    <div className="px-3 mb-4 text-xs font-semibold tracking-wider uppercase text-neutral-500">Platforms</div>
                    {platforms.map((platform) => (
                        <li key={platform.name} className='list-none'>
                            <button
                                onClick={() => { setActiveTab(platform.name); setIsSidebarOpen(false); }}
                                className={`group relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ${activeTab === platform.name ? 'bg-teal-500/10 text-teal-400' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'}`}
                            >
                                <platform.icon className="w-5 h-5" />
                                {platform.name}
                            </button>
                        </li>
                    ))}

                    <div className="px-3 mt-8 mb-4 text-xs font-semibold tracking-wider uppercase text-neutral-500">System</div>
                    <li className='list-none'>
                        <button
                            onClick={() => { setActiveTab('Settings'); setIsSidebarOpen(false); }}
                            className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ${activeTab === 'Settings' ? 'bg-teal-500/10 text-teal-400' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'}`}
                        >
                            <Settings className="w-5 h-5" />
                            Settings
                        </button>
                    </li>
                </nav>

                <div className="p-4 border-t border-neutral-800/60">
                    <button
                        onClick={onLogout}
                        className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm font-medium text-red-400 transition-colors rounded-xl bg-red-500/10 hover:bg-red-500/20"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 overflow-y-auto pt-20 md:p-8 md:pt-8">
                <header className="flex items-end justify-between mb-6 md:mb-8">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                            {activeTab === 'Settings' ? 'Scraper Settings' : `${activeTab} Monitor`}
                        </h1>
                    </div>
                </header>

                {activeTab === 'Settings' ? (
                    <div className="max-w-3xl space-y-8">
                        {/* Auth / Cookie Form */}
                        <div className="p-6 border rounded-2xl border-neutral-800 bg-neutral-900/50">
                            <h2 className="mb-4 text-lg font-semibold text-white">Platform Credentials</h2>
                            <form onSubmit={handleSaveCookie} className="flex flex-col gap-4 md:flex-row md:items-end">
                                <div className="flex-1">
                                    <label className="block mb-2 text-sm font-medium text-neutral-400">Vinted Session Cookie</label>
                                    <input
                                        type="password"
                                        value={cookieInput}
                                        onChange={(e) => setCookieInput(e.target.value)}
                                        placeholder="Paste your _vinted_fr_session cookie here..."
                                        className="w-full px-4 py-3 text-white border rounded-xl border-neutral-700 bg-neutral-950 placeholder:text-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                        required
                                    />
                                </div>
                                <button type="submit" className="flex items-center justify-center gap-2 px-6 py-3 font-medium text-white transition-colors bg-teal-600 rounded-xl hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500">
                                    <Key className="w-5 h-5" /> Save
                                </button>
                            </form>
                        </div>

                        {/* Tracker Form */}
                        <div className="p-6 border rounded-2xl border-neutral-800 bg-neutral-900/50">
                            <h2 className="mb-4 text-lg font-semibold text-white">Add New Tracker</h2>
                            <form onSubmit={handleAddKeyword} className="flex flex-col gap-4 md:flex-row md:items-end">
                                <div className="flex-1">
                                    <label className="block mb-2 text-sm font-medium text-neutral-400">Search Keyword</label>
                                    <input
                                        type="text"
                                        value={newSearchName}
                                        onChange={(e) => setNewSearchName(e.target.value)}
                                        placeholder="e.g. Nike Dunks"
                                        className="w-full px-4 py-3 text-white border rounded-xl border-neutral-700 bg-neutral-950 placeholder:text-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                        required
                                    />
                                </div>
                                <button type="submit" className="flex items-center justify-center gap-2 px-6 py-3 font-medium text-white transition-colors bg-teal-600 rounded-xl hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500">
                                    <Plus className="w-5 h-5" /> Track
                                </button>
                            </form>
                        </div>

                        {/* Watchlist */}
                        <div className="p-6 border rounded-2xl border-neutral-800 bg-neutral-900/50">
                            <h2 className="mb-4 text-lg font-semibold text-white">Active Watchlist ({watchlist.length})</h2>
                            {watchlist.length > 0 ? (
                                <ul className="divide-y divide-neutral-800/60">
                                    {watchlist.map((watchItem) => (
                                        <li key={watchItem.id} className="flex items-center justify-between py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800/80">
                                                    <Tag className="h-4 w-4 text-teal-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{watchItem.name}</p>
                                                    <p className="text-xs text-neutral-500">Active monitor</p>
                                                </div>
                                            </div>

                                            {/* NEW DELETE BUTTON */}
                                            <button
                                                onClick={() => deleteKeyword(watchItem.id)}
                                                className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                                                title="Remove Keyword"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl border-neutral-800/50 bg-neutral-950/50">
                                    <span className="text-neutral-500">Your watchlist is empty.</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
                        {filteredItems.length > 0 ? (
                            filteredItems.map((item) => <ItemCard key={item.id} item={item} />)
                        ) : (
                            <div className="flex flex-col items-center justify-center h-60 col-span-full rounded-2xl border-2 border-dashed border-neutral-800/50 bg-neutral-900/20">
                                <Zap className="w-8 h-8 mb-4 text-neutral-700" />
                                <span className="font-medium text-neutral-500">Waiting for drops...</span>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

// --- ENTRY POINT ---
export default function App() {
    const [userId, setUserId] = useState(localStorage.getItem('userId'));

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        setUserId(null);
    };

    if (!userId) {
        return <AuthScreen onAuthSuccess={(id) => setUserId(id)} />;
    }

    return <Dashboard userId={userId} onLogout={handleLogout} />;
}