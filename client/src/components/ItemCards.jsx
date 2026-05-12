// src/components/ItemCards.jsx
import { ExternalLink } from 'lucide-react';

export function ItemCard({ item }) {
    return (
        <div className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 transition-all duration-300 hover:border-teal-500/50 hover:bg-neutral-800/80 hover:shadow-[0_0_20px_rgba(20,184,166,0.1)]">

            {/* Image Container */}
            <div className="relative h-56 w-full overflow-hidden bg-neutral-950">
                <img
                    src={item.image_url} // 🟢 FIXED: Matches MySQL database column name
                    alt={item.title}
                    referrerPolicy="no-referrer" // 🟢 ADDED: Bypasses Vinted CDN security
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* Floating Price Tag */}
                <div className="absolute right-3 top-3 rounded-lg bg-black/80 px-2.5 py-1 text-sm font-bold text-white shadow-lg backdrop-blur-md">
                    {item.price} €
                </div>
            </div>

            {/* Details Container */}
            <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-2 text-sm font-semibold text-white" title={item.title}>
                    {item.title}
                </h3>

                <div className="mt-2 flex items-center justify-between text-xs font-medium text-neutral-400">
                    <span className="rounded-md bg-neutral-800 px-2 py-1">{item.brand}</span>
                    <span className="rounded-md bg-neutral-800 px-2 py-1">{item.size}</span>
                </div>

                <div className="mt-auto pt-4">
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500/10 py-2.5 text-sm font-medium text-teal-400 transition-colors duration-300 hover:bg-teal-500 hover:text-white"
                    >
                        View on {item.platform}
                        <ExternalLink className="h-4 w-4" />
                    </a>
                </div>
            </div>
        </div>
    );
}