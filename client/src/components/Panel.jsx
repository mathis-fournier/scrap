import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
    ShoppingBag, Package, Tag, Globe, Settings, Zap, Menu, X, Plus, Key, LogOut, Trash2, ShieldCheck, Users, Activity
} from 'lucide-react';
import { ItemCard } from './ItemCards';

const API_URL = "http://localhost:3000";

// --- 1. AUTHENTICATION SCREEN ---
function AuthScreen({ onAuthSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [tosAccepted, setTosAccepted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isLogin && !tosAccepted) {
            return setError("You must accept the Terms of Service to register.");
        }

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
            localStorage.setItem('role', data.role || 'user');
            onAuthSuccess(data.userId, data.role || 'user');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans text-white bg-neutral-950">
            <div className="w-full max-w-md p-8 border rounded-2xl border-neutral-800 bg-neutral-900/50 backdrop-blur-xl">
                <div className="flex flex-col items-center gap-3 mb-8">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                        <Zap className="w-6 h-6 text-white fill-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-wide">Finder<span className="text-teal-500">Pro</span></h1>
                    <p className="text-sm text-neutral-400">{isLogin ? 'Welcome back' : 'Create your account'}</p>
                </div>

                {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-500/10 rounded-xl">{error}</div>}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block mb-2 text-sm font-medium text-neutral-400">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 text-white border rounded-xl border-neutral-700 bg-neutral-950 focus:border-teal-500 focus:outline-none" required />
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-medium text-neutral-400">Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 text-white border rounded-xl border-neutral-700 bg-neutral-950 focus:border-teal-500 focus:outline-none" required />
                    </div>

                    {!isLogin && (
                        <div className="flex items-start gap-3 mt-2">
                            <input type="checkbox" id="tos" checked={tosAccepted} onChange={(e) => setTosAccepted(e.target.checked)} className="mt-1 accent-teal-500" />
                            <label htmlFor="tos" className="text-xs leading-relaxed text-neutral-400">
                                I understand this tool automates requests. I am using a secondary account. FinderPro is not responsible for any account bans.
                            </label>
                        </div>
                    )}

                    <button type="submit" className="w-full py-3 mt-2 font-medium text-white transition-colors bg-teal-600 rounded-xl hover:bg-teal-500">
                        {isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>

                <button onClick={() => { setIsLogin(!isLogin); setError(''); setTosAccepted(false); }} className="w-full mt-4 text-sm text-center transition-colors text-neutral-500 hover:text-white">
                    {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
            </div>
        </div>
    );
}

// --- 2. MAIN DASHBOARD SCREEN ---
function Dashboard({ userId, role, onLogout }) {
    const [activeTab, setActiveTab] = useState('Vinted');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [newSearchName, setNewSearchName] = useState('');
    const [cookieInput, setCookieInput] = useState('');
    const [cookieDead, setCookieDead] = useState(false);
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    
    // Admin State
    const [adminStats, setAdminStats] = useState({ users: 0, keywords: 0, items: 0 });
    const [adminUsers, setAdminUsers] = useState([]);

    // 🔒 Helper to grab the token for API calls
    const getAuthHeaders = () => {
        return { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    };

    const platforms = [
        { name: 'Vinted', icon: ShoppingBag },
        { name: 'Leboncoin', icon: Package },
        { name: 'Ebay', icon: Tag },
        { name: 'Others', icon: Globe },
    ];

    useEffect(() => {
        const socket = io(API_URL, { query: { userId } });
        socket.on('new-item', (newItem) => {
            setItems((prev) => prev.find(i => i.id === newItem.id) ? prev : [newItem, ...prev]);
        });
        socket.on('system-event', (event) => {
            if (event.type === 'COOKIE_DEAD') setCookieDead(true);
        });
        return () => socket.disconnect();
    }, [userId]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // 🛡️ Added Authentication Headers
                const kwRes = await fetch(`${API_URL}/api/keywords/${userId}`, {
                    headers: getAuthHeaders()
                });
                setWatchlist(await kwRes.json());

                // 🛡️ Added Authentication Headers
                const itemsRes = await fetch(`${API_URL}/api/items/${userId}`, {
                    headers: getAuthHeaders()
                });
                setItems(await itemsRes.json());
            } catch (err) {
                console.error("Failed to fetch initial data", err);
            }
        };
        fetchInitialData();
    }, [userId]);

    // Fetch Admin Data when tab changes to Admin
    useEffect(() => {
        if (activeTab === 'AdminPanel' && role === 'admin') {
            fetchAdminData();
        }
    }, [activeTab]);

    const fetchAdminData = async () => {
        try {
            // 🛡️ Added Authentication Headers
            const statsRes = await fetch(`${API_URL}/api/admin/stats?adminId=${userId}`, { headers: getAuthHeaders() });
            setAdminStats(await statsRes.json());

            // 🛡️ Added Authentication Headers
            const usersRes = await fetch(`${API_URL}/api/admin/users?adminId=${userId}`, { headers: getAuthHeaders() });
            setAdminUsers(await usersRes.json());
        } catch (err) {
            console.error("Failed to fetch admin data", err);
        }
    };

    const handleSaveCookie = async (e) => {
        e.preventDefault();
        // 🛡️ Added Authentication Headers
        await fetch(`${API_URL}/api/settings`, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            }, 
            body: JSON.stringify({ userId, cookie: cookieInput }) 
        });
        setCookieInput('');
        setCookieDead(false);
        alert('Cookie saved securely!');
    };

    const handleAddKeyword = async (e) => {
        e.preventDefault();
        const trimmedName = newSearchName.trim();
        if (!trimmedName) return;

        try {
            // 🛡️ Added Authentication Headers
            const res = await fetch(`${API_URL}/api/keywords`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    userId,
                    keyword: trimmedName,
                    minPrice: minPrice || null,
                    maxPrice: maxPrice || null
                })
            });

            if (res.ok) {
                const newKeyword = await res.json();
                setWatchlist([...watchlist, newKeyword]);
                setNewSearchName('');
                setMinPrice(''); 
                setMaxPrice('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const deleteKeyword = async (id) => {
        // 🛡️ Added Authentication Headers
        const res = await fetch(`${API_URL}/api/keywords/${id}?userId=${userId}`, { 
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (res.ok) setWatchlist(prev => prev.filter(kw => kw.id !== id));
    };

    const deleteUser = async (targetId) => {
        if (!window.confirm("Are you sure? This deletes the user and all their history permanently.")) return;
        // 🛡️ Added Authentication Headers
        const res = await fetch(`${API_URL}/api/admin/users/${targetId}?adminId=${userId}`, { 
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (res.ok) fetchAdminData();
    };

    const filteredItems = items.filter(item => item.platform === activeTab);

    return (
        <div className="flex w-full h-screen overflow-hidden font-sans bg-neutral-950 text-neutral-200">
            {/* Mobile Header */}
            <div className="fixed top-0 z-50 flex items-center justify-between w-full px-4 py-3 border-b md:hidden border-neutral-800 bg-neutral-900">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-teal-500" />
                    <span className="font-bold text-white">FinderPro</span>
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-neutral-400">
                    {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-neutral-800 bg-neutral-900/95 backdrop-blur-xl transition-transform duration-300 md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="items-center justify-between hidden h-16 px-6 border-b md:flex border-neutral-800/60 md:h-20">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-[0_0_15px_rgba(20,184,166,0.3)] md:h-10 md:w-10">
                            <Zap className="w-4 h-4 text-white fill-white" />
                        </div>
                        <span className="text-lg font-bold tracking-wide text-white md:text-xl">Finder<span className="text-teal-500">Pro</span></span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar">
                    <div className="px-3 mb-4 text-xs font-semibold tracking-wider uppercase text-neutral-500">Platforms</div>
                    {platforms.map((platform) => (
                        <li key={platform.name} className='list-none'>
                            <button onClick={() => { setActiveTab(platform.name); setIsSidebarOpen(false); }} className={`group relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ${activeTab === platform.name ? 'bg-teal-500/10 text-teal-400' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'}`}>
                                <platform.icon className="w-5 h-5" /> {platform.name}
                            </button>
                        </li>
                    ))}

                    <div className="px-3 mt-8 mb-4 text-xs font-semibold tracking-wider uppercase text-neutral-500">System</div>
                    <li className='list-none'>
                        <button onClick={() => { setActiveTab('Settings'); setIsSidebarOpen(false); }} className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ${activeTab === 'Settings' ? 'bg-teal-500/10 text-teal-400' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'}`}>
                            <Settings className="w-5 h-5" /> Settings
                        </button>
                    </li>

                    {/* ADMIN TAB */}
                    {role === 'admin' && (
                        <li className='list-none mt-2'>
                            <button onClick={() => { setActiveTab('AdminPanel'); setIsSidebarOpen(false); }} className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ${activeTab === 'AdminPanel' ? 'bg-indigo-500/10 text-indigo-400' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'}`}>
                                <ShieldCheck className="w-5 h-5 text-indigo-500" /> Admin Panel
                            </button>
                        </li>
                    )}
                </nav>

                <div className="p-4 border-t border-neutral-800/60">
                    <button onClick={onLogout} className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm font-medium text-red-400 transition-colors rounded-xl bg-red-500/10 hover:bg-red-500/20">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 pt-20 overflow-y-auto md:p-8 md:pt-8">

                {cookieDead && activeTab !== 'AdminPanel' && (
                    <div className="flex items-center justify-between p-4 mb-6 font-medium text-red-400 border border-red-500 bg-red-500/20 rounded-xl">
                        <span>⚠️ Scanning Halted: Your Vinted session cookie has expired or was banned.</span>
                        <button onClick={() => setActiveTab('Settings')} className="px-3 py-1 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600">Update</button>
                    </div>
                )}

                <header className="flex items-end justify-between mb-6 md:mb-8">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                            {activeTab === 'Settings' ? 'Scraper Settings' : activeTab === 'AdminPanel' ? 'System Overview' : `${activeTab} Monitor`}
                        </h1>
                    </div>
                </header>

                {activeTab === 'AdminPanel' ? (
                    <div className="space-y-6">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="p-6 border rounded-2xl border-neutral-800 bg-neutral-900/50">
                                <div className="flex items-center gap-3 mb-2 text-neutral-400"><Users className="w-5 h-5" /> Total Users</div>
                                <div className="text-3xl font-bold text-white">{adminStats.users}</div>
                            </div>
                            <div className="p-6 border rounded-2xl border-neutral-800 bg-neutral-900/50">
                                <div className="flex items-center gap-3 mb-2 text-neutral-400"><Activity className="w-5 h-5" /> Active Trackers</div>
                                <div className="text-3xl font-bold text-white">{adminStats.keywords}</div>
                            </div>
                            <div className="p-6 border rounded-2xl border-neutral-800 bg-neutral-900/50">
                                <div className="flex items-center gap-3 mb-2 text-neutral-400"><Package className="w-5 h-5" /> Items Scraped</div>
                                <div className="text-3xl font-bold text-white">{adminStats.items}</div>
                            </div>
                        </div>

                        {/* User Table */}
                        <div className="overflow-hidden border rounded-2xl border-neutral-800 bg-neutral-900/50">
                            <div className="p-6 border-b border-neutral-800">
                                <h2 className="text-lg font-semibold text-white">Registered Accounts</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-neutral-400">
                                    <thead className="text-xs uppercase bg-neutral-950/50 text-neutral-500">
                                        <tr>
                                            <th className="px-6 py-4">Email</th>
                                            <th className="px-6 py-4">Role</th>
                                            <th className="px-6 py-4">Proxy Setup</th>
                                            <th className="px-6 py-4">Cookie Health</th>
                                            <th className="px-6 py-4">Trackers</th>
                                            <th className="px-6 py-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-800">
                                        {adminUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-neutral-800/30">
                                                <td className="px-6 py-4 font-medium text-white">{user.email}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${user.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-neutral-800 text-neutral-300'}`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{user.proxy_url ? '✅ Assigned' : '❌ None'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${user.cookie_status === 'Active' ? 'bg-teal-500/20 text-teal-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {user.cookie_status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{user.keyword_count}</td>
                                                <td className="px-6 py-4">
                                                    <button onClick={() => deleteUser(user.id)} disabled={user.role === 'admin'} className="p-2 transition-colors disabled:opacity-50 text-neutral-500 hover:text-red-400">
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'Settings' ? (
                    <div className="max-w-3xl space-y-8">
                        {/* Auth / Cookie Form */}
                        <div className="p-6 border rounded-2xl border-neutral-800 bg-neutral-900/50">
                            <h2 className="mb-4 text-lg font-semibold text-white">Platform Credentials</h2>
                            <form onSubmit={handleSaveCookie} className="flex flex-col gap-4 md:flex-row md:items-end">
                                <div className="flex-1">
                                    <label className="block mb-2 text-sm font-medium text-neutral-400">Vinted Session Cookie</label>
                                    <input type="password" value={cookieInput} onChange={(e) => setCookieInput(e.target.value)} placeholder="Paste your cookie..." className="w-full px-4 py-3 text-white border rounded-xl border-neutral-700 bg-neutral-950 focus:border-teal-500 focus:outline-none" required />
                                </div>
                                <button type="submit" className="flex items-center justify-center gap-2 px-6 py-3 font-medium text-white transition-colors bg-teal-600 rounded-xl hover:bg-teal-500">
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
                                    <input type="text" value={newSearchName} onChange={(e) => setNewSearchName(e.target.value)} placeholder="e.g. Nike Dunks" className="w-full px-4 py-3 text-white border rounded-xl border-neutral-700 bg-neutral-950 focus:border-teal-500 focus:outline-none" required />
                                </div>
                                {/* NEW PRICE INPUTS */}
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block mb-2 text-sm font-medium text-neutral-400">Min Price (€)</label>
                                        <input type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" className="w-full px-4 py-3 text-white border rounded-xl border-neutral-700 bg-neutral-950 focus:border-teal-500 focus:outline-none" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block mb-2 text-sm font-medium text-neutral-400">Max Price (€)</label>
                                        <input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="100" className="w-full px-4 py-3 text-white border rounded-xl border-neutral-700 bg-neutral-950 focus:border-teal-500 focus:outline-none" />
                                    </div>
                                </div>
                                <button type="submit" className="flex items-center justify-center gap-2 px-6 py-3 font-medium text-white transition-colors bg-teal-600 rounded-xl hover:bg-teal-500">
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
                                        <li key={watchItem.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-neutral-800/80">
                                                    <Tag className="w-4 h-4 text-teal-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{watchItem.name}</p>
                                                    <p className="text-xs text-neutral-500">
                                                        Active monitor {watchItem.min_price || watchItem.max_price ? `• ${watchItem.min_price || 0}€ - ${watchItem.max_price || '∞'}€` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => deleteKeyword(watchItem.id)} className="p-2 transition-colors text-neutral-500 hover:text-red-400">
                                                <Trash2 className="w-5 h-5" />
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

export default function PanelApp() {
    const [userId, setUserId] = useState(localStorage.getItem('userId'));
    const [role, setRole] = useState(localStorage.getItem('role') || 'user');

    const handleAuthSuccess = (id, newRole) => {
        setUserId(id);
        setRole(newRole);
    };

    const handleLogout = () => {
        localStorage.clear();
        setUserId(null);
        setRole('user');
    };

    if (!userId) {
        return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
    }

    return <Dashboard userId={userId} role={role} onLogout={handleLogout} />;
}