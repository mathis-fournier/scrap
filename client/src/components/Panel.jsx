import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
    ShoppingBag,
    Package,
    Tag,
    Globe,
    Settings,
    Zap,
    Menu,
    X,
    Trash2,
    Plus
} from 'lucide-react';
import { ItemCard } from './ItemCards';

const socket = io('http://localhost:3000');

export default function Panel() {
    const [activeTab, setActiveTab] = useState('Vinted');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [items, setItems] = useState([]);

    // --- State for Settings / Watchlist ---
    // Initialize from localStorage
    const [watchlist, setWatchlist] = useState(() => {
        const saved = localStorage.getItem('watchlist');
        return saved ? JSON.parse(saved) : [];
    });

    const [newSearchName, setNewSearchName] = useState('');

    const platforms = [
        { name: 'Vinted', icon: ShoppingBag },
        { name: 'Leboncoin', icon: Package },
        { name: 'Ebay', icon: Tag },
        { name: 'Others', icon: Globe },
    ];

    // Persist watchlist whenever it changes
    useEffect(() => {
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
    }, [watchlist]);

    // Send saved watchlist to backend on first mount
    useEffect(() => {
        if (watchlist.length > 0) {
            socket.emit('update-watchlist', watchlist);
        }
    }, []);

    useEffect(() => {
        const handleNewItem = (newItem) => {
            setItems((prevItems) => {
                if (prevItems.find(i => i.id === newItem.id)) return prevItems;
                return [newItem, ...prevItems];
            });

            if (Notification.permission === "granted") {
                new Notification(`New ${newItem.platform} Item!`, {
                    body: newItem.title,
                });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        };

        const handleHistory = (historyData) => {
            setItems(historyData);
        };

        socket.on('new-item', handleNewItem);
        socket.on('history', handleHistory);

        return () => {
            socket.off('new-item', handleNewItem);
            socket.off('history', handleHistory);
        };
    }, []);

    // --- Watchlist Handlers ---
    const handleAddKeyword = (e) => {
        e.preventDefault();

        const trimmedName = newSearchName.trim();
        if (!trimmedName) return;

        // Prevent duplicates
        if (
            watchlist.some(
                (item) =>
                    item.name.toLowerCase() === trimmedName.toLowerCase()
            )
        ) {
            setNewSearchName('');
            return;
        }

        // Automatically construct the Vinted API URL
        const encodedKeyword = encodeURIComponent(trimmedName);

        const autoConstructedUrl =
            `https://www.vinted.fr/api/v2/catalog/items?search_text=${encodedKeyword}&order=newest_first`;

        const newWatchlist = [
            ...watchlist,
            {
                name: trimmedName,
                apiUrl: autoConstructedUrl
            }
        ];

        setWatchlist(newWatchlist);

        // Send to backend
        socket.emit('update-watchlist', newWatchlist);

        setNewSearchName('');
    };

    const handleRemoveKeyword = (nameToRemove) => {
        const newWatchlist = watchlist.filter(
            (w) => w.name !== nameToRemove
        );

        setWatchlist(newWatchlist);

        // Send to backend
        socket.emit('update-watchlist', newWatchlist);
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const filteredItems = items.filter(
        (item) => item.platform === activeTab
    );

    return (
        <div className="flex h-screen w-full overflow-hidden bg-neutral-950 font-sans text-neutral-200">
            {/* Mobile Header */}
            <div className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-3 md:hidden">
                <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-teal-500" />
                    <span className="font-bold text-white">FinderPro</span>
                </div>
                <button onClick={toggleSidebar} className="text-neutral-400 hover:text-white">
                    {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-neutral-800 bg-neutral-900/95 backdrop-blur-xl transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="hidden h-16 items-center justify-between border-b border-neutral-800/60 px-6 md:flex md:h-20">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-[0_0_15px_rgba(20,184,166,0.3)] md:h-10 md:w-10">
                            <Zap className="h-4 w-4 fill-white text-white md:h-5 md:w-5" />
                        </div>
                        <span className="text-lg font-bold tracking-wide text-white md:text-xl">
                            Finder<span className="text-teal-500">Pro</span>
                        </span>
                    </div>
                </div>

                <nav className="no-scrollbar flex-1 overflow-y-auto px-4 py-6">
                    <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Platforms</div>
                    {platforms.map((platform) => (
                        <li key={platform.name} className='list-none'>
                            <button
                                onClick={() => {
                                    setActiveTab(platform.name);
                                    setIsSidebarOpen(false);
                                }}
                                className={`group relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ${activeTab === platform.name ? 'bg-teal-500/10 text-teal-400' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'}`}
                            >
                                <platform.icon className="h-5 w-5" />
                                {platform.name}
                            </button>
                        </li>
                    ))}

                    <div className="mt-8 mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">System</div>
                    <li className='list-none'>
                        <button
                            onClick={() => {
                                setActiveTab('Settings');
                                setIsSidebarOpen(false);
                            }}
                            className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ${activeTab === 'Settings' ? 'bg-teal-500/10 text-teal-400' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'}`}
                        >
                            <Settings className="h-5 w-5" />
                            Settings
                        </button>
                    </li>
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 pt-20 md:p-8 md:pt-8">
                <header className="mb-6 flex items-end justify-between md:mb-8">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                            {activeTab === 'Settings' ? 'Scraper Settings' : `${activeTab} Monitor`}
                        </h1>
                        <p className="mt-2 text-sm text-neutral-400 md:text-base">
                            {activeTab === 'Settings'
                                ? 'Manage your search keywords. We automatically format them to grab the newest drops.'
                                : `Watching live. Found ${filteredItems.length} items so far.`}
                        </p>
                    </div>

                    {activeTab !== 'Settings' && (
                        <div className="flex items-center gap-3">
                            <span className="relative flex h-3 w-3">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75"></span>
                                <span className="relative inline-flex h-3 w-3 rounded-full bg-teal-500"></span>
                            </span>
                            <span className="text-sm font-medium text-teal-500">Live Scraping</span>
                        </div>
                    )}
                </header>

                {activeTab === 'Settings' ? (
                    /* --- SETTINGS VIEW --- */
                    <div className="max-w-3xl space-y-8">
                        {/* Add New Keyword Form */}
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
                            <h2 className="mb-4 text-lg font-semibold text-white">Add New Tracker</h2>
                            <form onSubmit={handleAddKeyword} className="flex flex-col gap-4 md:flex-row md:items-end">
                                <div className="flex-1">
                                    <label className="mb-2 block text-sm font-medium text-neutral-400">Search Keyword (e.g. Nike Dunks)</label>
                                    <input
                                        type="text"
                                        value={newSearchName}
                                        onChange={(e) => setNewSearchName(e.target.value)}
                                        placeholder="Enter the item you're looking for..."
                                        className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 font-medium text-white transition-colors hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-neutral-950"
                                >
                                    <Plus className="h-5 w-5" />
                                    Start Tracking
                                </button>
                            </form>
                        </div>

                        {/* Active Watchlist */}
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
                            <h2 className="mb-4 text-lg font-semibold text-white">Active Watchlist ({watchlist.length})</h2>
                            {watchlist.length > 0 ? (
                                <ul className="divide-y divide-neutral-800/60">
                                    {watchlist.map((watchItem, index) => (
                                        <li key={index} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800/80">
                                                    <Tag className="h-4 w-4 text-teal-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{watchItem.name}</p>
                                                    <p className="text-xs text-neutral-500">Scanning newest drops</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveKeyword(watchItem.name)}
                                                className="mt-2 flex w-fit items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/20 sm:mt-0"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex h-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-800/50 bg-neutral-950/50">
                                    <span className="text-neutral-500">Your watchlist is empty. Add a keyword above!</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* --- ITEM GRID VIEW --- */
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
                        {filteredItems.length > 0 ? (
                            filteredItems.map((item) => (
                                <ItemCard key={item.id} item={item} />
                            ))
                        ) : (
                            <div className="col-span-full flex h-60 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-800/50 bg-neutral-900/20">
                                <Zap className="mb-4 h-8 w-8 text-neutral-700" />
                                <span className="font-medium text-neutral-500">Waiting for new {activeTab} drops...</span>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}