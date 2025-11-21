import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, NavLink as RouterNavLink } from 'react-router-dom';
import { api, resolveImageUrl } from '../../services/api';
import { Link, LinkStatus, Order, OrderStatus, Product, UserRole, Complaint, ComplaintStatus, Company, Connection, BlacklistEntry } from '../../types';
import { useApp } from '../../App';

const panelBase = 'rounded-3xl border border-system-border/40 bg-white/90 backdrop-blur-md shadow-[0_28px_80px_-36px_rgba(15,23,42,0.45)]';
const panelPadding = 'p-6 md:p-8';
const panelClass = `${panelBase} ${panelPadding}`;

const supplierNavItems = [
    { label: 'Overview', to: '/supplier', exact: true },
    { label: 'Catalog', to: '/supplier/products' },
    { label: 'Orders', to: '/supplier/orders' },
    { label: 'Complaints', to: '/supplier/complaints' },
    { label: 'Team', to: '/supplier/team' },
    { label: 'Connections', to: '/supplier/connections' },
    { label: 'Settings', to: '/supplier/settings' },
];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

export default function SupplierDashboard() {
    const { user, setUser } = useApp();
    const navigate = useNavigate();

    const handleLogout = () => {
        api.logout();
        setUser(null);
        navigate('/login');
    };

    // Filter nav items based on user role
    const visibleNavItems = supplierNavItems.filter(item => {
        // Only show Team for owners
        if (item.label === 'Team' && user?.role !== UserRole.SUPPLIER_OWNER) {
            return false;
        }
        return true;
    });

    return (
        <div className="min-h-screen bg-gradient-to-b from-system-bg via-white to-white">
            {/* Fixed Navigation Bar */}
            <div className="sticky top-0 z-40 border-b border-system-border/30 bg-white/95 backdrop-blur-md">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-8">
                    <div className="flex items-center gap-6">
                        <div>
                            <h2 className="text-lg font-semibold text-system-text">Supplier Dashboard</h2>
                            <p className="text-xs text-system-textSec hidden sm:block">Control Center</p>
                        </div>
                        <nav className="flex items-center gap-1">
                            {visibleNavItems.map(item => (
                                <RouterNavLink
                                    key={item.label}
                                    to={item.to}
                                    end={item.exact}
                                    className={({ isActive }) =>
                                        `flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all min-w-[80px] text-center ${
                                            isActive
                                                ? 'bg-system-text text-white shadow-sm'
                                                : 'text-system-textSec hover:bg-system-bg hover:text-system-text'
                                        }`
                                    }
                                >
                                    {item.label}
                                </RouterNavLink>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden md:block">
                            <div className="text-xs font-medium text-system-text">{user?.email}</div>
                            <div className="text-[10px] text-system-textSec uppercase tracking-wider">
                                {user?.role.replace('SUPPLIER_', '').toLowerCase()}
                            </div>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                            title="Logout"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
                <header className="text-center">
                    <h1 className="text-3xl font-bold text-system-text tracking-tight">Supplier Control Center</h1>
                    <p className="mt-2 max-w-2xl mx-auto text-sm text-system-textSec">
                        Monitor relationships, track orders, and keep your catalog humming—all in one modern workspace.
                    </p>
                </header>

                <div className="pb-12">
                    <Routes>
                        <Route index element={<Overview />} />
                        <Route path="products" element={<Inventory />} />
                        <Route path="orders" element={<OrderManagement />} />
                        <Route path="complaints" element={<ComplaintsManagement />} />
                        <Route path="team" element={<TeamManagement />} />
                        <Route path="connections" element={<ConnectionManagement />} />
                        <Route path="settings" element={<CompanySettings />} />
                        <Route path="*" element={<Overview />} />
                    </Routes>
                </div>
            </div>
        </div>
    );
}

type PageHeroProps = {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
};

function PageHero({ title, subtitle, actions }: PageHeroProps) {
    return (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-600 text-white shadow-[0_40px_90px_-35px_rgba(59,130,246,0.55)]">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
                    {subtitle && <p className="mt-2 max-w-xl text-white/80">{subtitle}</p>}
                </div>
                {actions && <div className="flex-shrink-0">{actions}</div>}
            </div>
        </div>
    );
}

function Overview() {
    const [links, setLinks] = useState<Link[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            try {
                const [linksData, ordersData, productsData] = await Promise.all([
                    api.getMyLinks(),
                    api.getMyOrders(),
                    api.getProducts(),
                ]);

                if (!isMounted) return;
                setLinks(linksData);
                setOrders(ordersData);
                setProducts(productsData);
            } catch (error) {
                console.error('Failed to load supplier overview:', error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, []);

    const refreshLinks = async () => {
        try {
            setLinks(await api.getMyLinks());
        } catch (error) {
            console.error('Failed to refresh links:', error);
        }
    };

    const handleStatusChange = async (linkId: number, status: LinkStatus) => {
        try {
            await api.updateLinkStatus(linkId, status);
            await refreshLinks();
        } catch (error: any) {
            alert(error.message || 'Failed to update request status');
        }
    };

    const pendingLinks = links.filter(link => link.status === LinkStatus.PENDING);
    const activeLinks = links.filter(link => link.status === LinkStatus.APPROVED);

    const pipelineOrders = orders.filter(order =>
        [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.IN_DELIVERY].includes(order.status)
    );
    const completedOrders = orders.filter(order => order.status === OrderStatus.COMPLETED);

    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
    const outOfStock = products.filter(product => product.stock_quantity === 0).length;
    const lowStockProducts = products
        .filter(product => product.stock_quantity > 0 && product.stock_quantity <= Math.max(product.min_order_qty * 2, 5))
        .slice(0, 4);

    const statCards = [
        {
            label: 'Active Consumers',
            value: activeLinks.length.toLocaleString(),
            caption: 'Approved connections currently trading'
        },
        {
            label: 'Open Orders',
            value: pipelineOrders.length.toLocaleString(),
            caption: 'Pending, accepted, or in delivery'
        },
        {
            label: 'Revenue (lifetime)',
            value: formatCurrency(totalRevenue),
            caption: `${completedOrders.length} completed orders`
        },
        {
            label: 'Catalog Items',
            value: products.length.toLocaleString(),
            caption: outOfStock ? `${outOfStock} out of stock` : 'All items available'
        },
    ];

    const orderStatusStyles = (status: OrderStatus) => {
        switch (status) {
            case OrderStatus.PENDING:
                return 'bg-amber-100 text-amber-700';
            case OrderStatus.ACCEPTED:
                return 'bg-blue-100 text-blue-700';
            case OrderStatus.IN_DELIVERY:
                return 'bg-purple-100 text-purple-700';
            case OrderStatus.COMPLETED:
                return 'bg-emerald-100 text-emerald-700';
            case OrderStatus.REJECTED:
            case OrderStatus.CANCELLED:
                return 'bg-red-100 text-red-700';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in">
            <PageHero
                title="Daily Pulse"
                subtitle="A real-time snapshot of revenue, relationships, and fulfillment performance."
                actions={
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                        {pipelineOrders.length} orders in motion
                    </div>
                }
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {statCards.map(card => (
                    <div key={card.label} className={`${panelClass} relative overflow-hidden`}
                        aria-live={loading ? 'polite' : undefined}>
                        <div className="absolute inset-0 bg-gradient-to-br from-system-bg via-transparent to-transparent opacity-60" aria-hidden="true" />
                        <div className="relative space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-system-textSec">{card.label}</p>
                            <p className="text-3xl font-semibold text-system-text md:text-4xl">{card.value}</p>
                            <p className="text-sm text-system-textSec">{card.caption}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className={`${panelClass} space-y-6`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-system-text">Pending Connection Requests</h3>
                            <p className="text-sm text-system-textSec">Review and respond to new consumer invitations.</p>
                        </div>
                        <span className="rounded-full bg-system-blue/10 px-3 py-1 text-xs font-semibold text-system-blue">{pendingLinks.length}</span>
                    </div>

                    {pendingLinks.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-system-border/70 bg-system-bg px-6 py-10 text-center text-sm text-system-textSec">
                            All caught up. New connection requests will show up here.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingLinks.map(link => (
                                <div key={link.id} className="flex flex-col gap-4 rounded-2xl border border-system-border/70 bg-system-bg p-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="font-semibold text-system-text">Consumer #{link.consumer_id}</p>
                                        <p className="text-xs text-system-textSec">Request ID: {link.id}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            className="rounded-full bg-system-text px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                                            onClick={() => handleStatusChange(link.id, LinkStatus.APPROVED)}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                                            onClick={() => handleStatusChange(link.id, LinkStatus.REJECTED)}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className={`${panelClass} space-y-6`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-system-text">Order Pipeline</h3>
                            <p className="text-sm text-system-textSec">Track orders through acceptance, delivery, and completion.</p>
                        </div>
                        <RouterNavLink
                            to="/supplier/orders"
                            className="text-xs font-semibold text-system-blue transition-colors hover:text-blue-600"
                        >
                            View all orders →
                        </RouterNavLink>
                    </div>

                    {pipelineOrders.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-system-border/70 bg-system-bg px-6 py-10 text-center text-sm text-system-textSec">
                            No orders in progress. Completed and rejected orders live in the orders tab.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pipelineOrders.slice(0, 4).map(order => (
                                <div key={order.id} className="flex flex-col gap-3 rounded-2xl border border-system-border/70 bg-system-bg p-4 md:flex-row md:items-center md:justify-between">
                                    <div className="space-y-1">
                                        <p className="font-semibold text-system-text">Order #{order.id}</p>
                                        <p className="text-xs text-system-textSec">Consumer #{order.consumer_id} • {order.items.length} items</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusStyles(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                        <p className="text-sm font-semibold text-system-text">{formatCurrency(order.total_amount)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className={`${panelClass} space-y-6`}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-system-text">Inventory Signals</h3>
                        <p className="text-sm text-system-textSec">Watch stock levels and keep best sellers available.</p>
                    </div>
                    <RouterNavLink
                        to="/supplier/products"
                        className="text-xs font-semibold text-system-blue transition-colors hover:text-blue-600"
                    >
                        Manage products →
                    </RouterNavLink>
                </div>

                {loading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {[...Array(4)].map((_, index) => (
                            <div key={index} className="h-20 animate-pulse rounded-2xl bg-system-bg" />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {lowStockProducts.length === 0 ? (
                            <div className="col-span-full rounded-2xl border border-dashed border-system-border/70 bg-system-bg px-6 py-8 text-center text-sm text-system-textSec">
                                Stock levels look healthy. We will highlight low inventory items here.
                            </div>
                        ) : (
                            lowStockProducts.map(product => (
                                <div key={product.id} className="flex items-center gap-4 rounded-2xl border border-system-border/70 bg-system-bg p-4">
                                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white">
                                        {resolveImageUrl(product.image_url) ? (
                                            <img src={resolveImageUrl(product.image_url)} alt={product.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-xl">📦</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-system-text">{product.name}</p>
                                        <p className="text-xs text-system-textSec">SKU {product.sku}</p>
                                        <p className="mt-1 text-xs font-semibold text-system-red">
                                            {product.stock_quantity} in stock • Min order {product.min_order_qty}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                <div className="rounded-2xl border border-system-border/50 bg-system-bg p-6 text-sm text-system-textSec">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="font-semibold text-system-text">Average order value</p>
                            <p className="text-sm text-system-textSec">Completed orders only</p>
                        </div>
                        <p className="text-2xl font-semibold text-system-text">{averageOrderValue ? formatCurrency(averageOrderValue) : '—'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Inventory() {
    const { user } = useApp();
    const [products, setProducts] = useState<Product[]>([]);
    const canEdit = user?.role === UserRole.SUPPLIER_OWNER || user?.role === UserRole.SUPPLIER_MANAGER;
    const [newProd, setNewProd] = useState({ name: '', price: 0, stock_quantity: 0, sku: '', min_order_qty: 1 });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Partial<Product>>({});
    const [editImageFile, setEditImageFile] = useState<File | null>(null);

    useEffect(() => {
        const loadProducts = () => api.getProducts().then(setProducts).catch(console.error);
        loadProducts();
        
        // Listen for real-time product updates
        window.addEventListener('product_update', loadProducts);
        return () => window.removeEventListener('product_update', loadProducts);
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) return;

        try {
            if (!newProd.name || !newProd.sku || newProd.price <= 0 || newProd.stock_quantity < 0) {
                alert('Please provide valid product details.');
                return;
            }

            await api.createProduct({
                name: newProd.name,
                sku: newProd.sku,
                price: newProd.price,
                stock_quantity: newProd.stock_quantity,
                min_order_qty: newProd.min_order_qty,
                is_active: newProd.stock_quantity > 0,
                image: imageFile,
            });

            setProducts(await api.getProducts());
            setNewProd({ name: '', price: 0, stock_quantity: 0, sku: '', min_order_qty: 1 });
            setImageFile(null);
            alert('Product created successfully!');
        } catch (error: any) {
            alert('Failed to create product: ' + (error.message || 'Unknown error'));
        }
    };

    const handleEdit = (product: Product) => {
        setEditingId(product.id);
        setEditForm({ ...product });
        setEditImageFile(null);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm({});
        setEditImageFile(null);
    };

    const handleSaveEdit = async (productId: number) => {
        if (!canEdit) return;

        try {
            const payload: {
                name?: string;
                price?: number;
                stock_quantity?: number;
                min_order_qty?: number;
                is_active?: boolean;
                image?: File | null;
            } = {};

            if (editForm.name !== undefined) payload.name = editForm.name;
            if (editForm.price !== undefined && !Number.isNaN(editForm.price)) payload.price = editForm.price;
            if (editForm.stock_quantity !== undefined && !Number.isNaN(editForm.stock_quantity)) {
                payload.stock_quantity = editForm.stock_quantity;
                payload.is_active = editForm.stock_quantity > 0;
            }
            if (editForm.min_order_qty !== undefined && !Number.isNaN(editForm.min_order_qty)) {
                payload.min_order_qty = editForm.min_order_qty;
            }
            if (editImageFile) {
                payload.image = editImageFile;
            }

            await api.updateProduct(productId, payload);
            setProducts(await api.getProducts());
            setEditingId(null);
            setEditForm({});
            setEditImageFile(null);
            alert('Product updated successfully!');
        } catch (error: any) {
            alert('Failed to update product: ' + (error.message || 'Unknown error'));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        } else {
            setImageFile(null);
        }
    };

    const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setEditImageFile(e.target.files[0]);
        } else {
            setEditImageFile(null);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in">
            <PageHero
                title="Catalog Management"
                subtitle="Launch new SKUs, curate your assortment, and keep inventory aligned with demand."
                actions={
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-600">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {products.filter(p => p.is_active).length} live products
                    </div>
                }
            />

            {canEdit && (
                <div className={`${panelClass} space-y-6`}>
                    <div>
                        <h3 className="text-xl font-semibold text-system-text">Add New Product</h3>
                        <p className="text-sm text-system-textSec">Create a listing with pricing, availability, and imagery in one step.</p>
                    </div>
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-system-textSec">Product Name</label>
                                <input
                                    className="w-full rounded-2xl border border-system-border/60 bg-system-bg px-4 py-3 text-sm outline-none transition focus:border-system-blue focus:ring-2 focus:ring-system-blue/20"
                                    value={newProd.name}
                                    onChange={e => setNewProd({ ...newProd, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-system-textSec">SKU</label>
                                <input
                                    className="w-full rounded-2xl border border-system-border/60 bg-system-bg px-4 py-3 text-sm outline-none transition focus:border-system-blue focus:ring-2 focus:ring-system-blue/20"
                                    value={newProd.sku}
                                    onChange={e => setNewProd({ ...newProd, sku: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-system-textSec">Price ($)</label>
                                <input
                                    type="number"
                                    className="w-full rounded-2xl border border-system-border/60 bg-system-bg px-4 py-3 text-sm outline-none transition focus:border-system-blue focus:ring-2 focus:ring-system-blue/20"
                                    value={newProd.price || ''}
                                    onChange={e => setNewProd({
                                        ...newProd,
                                        price: e.target.value === '' ? 0 : parseFloat(e.target.value)
                                    })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-system-textSec">Stock</label>
                                <input
                                    type="number"
                                    className="w-full rounded-2xl border border-system-border/60 bg-system-bg px-4 py-3 text-sm outline-none transition focus:border-system-blue focus:ring-2 focus:ring-system-blue/20"
                                    value={newProd.stock_quantity || ''}
                                    onChange={e => setNewProd({
                                        ...newProd,
                                        stock_quantity: e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                                    })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-system-textSec">Minimum Order Qty</label>
                                <input
                                    type="number"
                                    className="w-full rounded-2xl border border-system-border/60 bg-system-bg px-4 py-3 text-sm outline-none transition focus:border-system-blue focus:ring-2 focus:ring-system-blue/20"
                                    value={newProd.min_order_qty || ''}
                                    onChange={e => setNewProd({
                                        ...newProd,
                                        min_order_qty: e.target.value === '' ? 1 : parseInt(e.target.value, 10)
                                    })}
                                    min={1}
                                    required
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-semibold uppercase text-system-textSec">Product Image</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-system-textSec file:mr-4 file:rounded-full file:border-0 file:bg-system-blue/10 file:px-5 file:py-2 file:font-semibold file:text-system-blue hover:file:bg-system-blue/20"
                                />
                                {imageFile && <p className="text-xs text-system-textSec">Selected: {imageFile.name}</p>}
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="rounded-xl bg-system-text px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black">Add Product</button>
                        </div>
                    </form>
                </div>
            )}

            <div className={`${panelBase} overflow-hidden`}>
                <div className="border-b border-system-border/60 bg-system-bg/60 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-system-text md:px-8">
                    Product Catalog
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm">
                        <thead>
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">Image</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">SKU</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">Name</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">Price</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">Stock</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">Min Order</th>
                                {canEdit && <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-system-border/40">
                        {products.map(product => (
                            <tr key={product.id} className="transition-all duration-200 hover:bg-system-bg/60">
                                {editingId === product.id ? (
                                    <>
                                        <td className="px-6 py-5 md:px-8">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-system-bg">
                                                    {resolveImageUrl(product.image_url) ? (
                                                        <img src={resolveImageUrl(product.image_url)} className="h-full w-full object-cover" />
                                                    ) : '📦'}
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleEditFileChange}
                                                    className="block text-xs text-system-textSec file:mr-2 file:rounded-full file:border-0 file:bg-system-blue/10 file:px-4 file:py-1.5 file:text-system-blue hover:file:bg-system-blue/20"
                                                />
                                                {editImageFile && <p className="text-[10px] text-system-textSec">New file: {editImageFile.name}</p>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 font-mono text-xs text-system-textSec md:px-8">{product.sku}</td>
                                        <td className="px-6 py-5 md:px-8">
                                            <input
                                                value={editForm.name || ''}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full rounded-xl border border-system-border/60 bg-system-bg px-3 py-2 text-sm outline-none transition focus:border-system-blue focus:ring-1 focus:ring-system-blue/30"
                                            />
                                        </td>
                                        <td className="px-6 py-5 md:px-8">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editForm.price ?? ''}
                                                onChange={e => setEditForm({
                                                    ...editForm,
                                                    price: e.target.value === '' ? undefined : parseFloat(e.target.value)
                                                })}
                                                className="w-24 rounded-xl border border-system-border/60 bg-system-bg px-3 py-2 text-sm outline-none transition focus:border-system-blue focus:ring-1 focus:ring-system-blue/30"
                                            />
                                        </td>
                                        <td className="px-6 py-5 md:px-8">
                                            <input
                                                type="number"
                                                value={editForm.stock_quantity ?? ''}
                                                onChange={e => setEditForm({
                                                    ...editForm,
                                                    stock_quantity: e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                                                })}
                                                className="w-24 rounded-xl border border-system-border/60 bg-system-bg px-3 py-2 text-sm outline-none transition focus:border-system-blue focus:ring-1 focus:ring-system-blue/30"
                                            />
                                        </td>
                                        <td className="px-6 py-5 md:px-8">
                                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                                (editForm.stock_quantity ?? 0) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-system-textSec'
                                            }`}>
                                                <span className={`h-2 w-2 rounded-full ${(editForm.stock_quantity ?? 0) > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                {(editForm.stock_quantity ?? 0) > 0 ? 'Will be Active' : 'Will be Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 md:px-8">
                                            <input
                                                type="number"
                                                min={1}
                                                value={editForm.min_order_qty ?? ''}
                                                onChange={e => setEditForm({
                                                    ...editForm,
                                                    min_order_qty: e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                                                })}
                                                className="w-24 rounded-xl border border-system-border/60 bg-system-bg px-3 py-2 text-sm outline-none transition focus:border-system-blue focus:ring-1 focus:ring-system-blue/30"
                                            />
                                        </td>
                                        <td className="px-6 py-5 md:px-8">
                                            <div className="flex gap-2">
                                                <button onClick={() => handleSaveEdit(product.id)} className="rounded-xl bg-system-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-600">Save</button>
                                                <button onClick={handleCancelEdit} className="rounded-xl bg-system-textSec px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-600">Cancel</button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-5 md:px-8">
                                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-system-bg">
                                                {resolveImageUrl(product.image_url) ? (
                                                    <img src={resolveImageUrl(product.image_url)} className="h-full w-full object-cover" />
                                                ) : '📦'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 font-mono text-xs text-system-textSec md:px-8">{product.sku}</td>
                                        <td className="px-6 py-5 font-semibold text-system-text md:px-8">{product.name}</td>
                                        <td className="px-6 py-5 text-system-text md:px-8">${product.price.toFixed(2)}</td>
                                        <td className="px-6 py-5 text-system-text md:px-8">{product.stock_quantity}</td>
                                        <td className="px-6 py-5 md:px-8">
                                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                                product.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-system-textSec'
                                            }`}>
                                                <span className={`h-2 w-2 rounded-full ${product.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                {product.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-system-text md:px-8">{product.min_order_qty ?? '—'}</td>
                                        {canEdit && (
                                            <td className="px-6 py-5 md:px-8">
                                                <button onClick={() => handleEdit(product)} className="text-sm font-semibold text-system-blue transition-colors hover:text-blue-600">Edit</button>
                                            </td>
                                        )}
                                    </>
                                )}
                            </tr>
                        ))}
                        {products.length === 0 && (
                            <tr>
                                <td colSpan={canEdit ? 8 : 7} className="px-6 py-12 text-center text-sm text-system-textSec md:px-8">
                                    No products yet. Create your first catalog item above.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    );
}
function OrderManagement() {
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        const loadOrders = () => api.getMyOrders().then(setOrders).catch(console.error);
        loadOrders();
        
        // Listen for real-time order updates
        window.addEventListener('order_update', loadOrders);
        return () => window.removeEventListener('order_update', loadOrders);
    }, []);

    const handleOrder = async (id: number, status: string) => {
        try {
            await api.updateOrderStatus(id, status);
            setOrders(await api.getMyOrders());
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <h2 className="text-2xl font-bold text-system-text tracking-tight">Incoming Orders</h2>
            <div className="space-y-4">
                {orders.map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50 hover:shadow-lg transition-shadow">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-bold text-lg text-system-text">Order #{order.id}</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                         order.status === OrderStatus.PENDING ? 'bg-system-blue/10 text-system-blue' :
                                         order.status === OrderStatus.ACCEPTED ? 'bg-system-green/10 text-system-green' :
                                         order.status === OrderStatus.IN_DELIVERY ? 'bg-purple-100 text-purple-700' :
                                         order.status === OrderStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                         order.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-700' :
                                         order.status === OrderStatus.CANCELLED ? 'bg-gray-100 text-gray-700' :
                                         'bg-gray-100 text-gray-600'
                                    }`}>{order.status}</span>
                                </div>
                                <p className="text-sm text-system-textSec">Consumer ID: {order.consumer_id} • {order.items.length} items</p>
                            </div>
                            
                            <div className="text-right">
                                <p className="font-bold text-xl text-system-text mb-3">${order.total_amount.toFixed(2)}</p>
                                <div className="flex gap-3">
                                    {order.status === OrderStatus.PENDING && (
                                        <>
                                            <button 
                                                onClick={() => handleOrder(order.id, OrderStatus.ACCEPTED)}
                                                className="bg-system-text text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-black"
                                            >
                                                Accept
                                            </button>
                                            <button 
                                                onClick={() => handleOrder(order.id, OrderStatus.REJECTED)}
                                                className="bg-white border border-system-border text-system-red px-5 py-2 rounded-full text-sm font-medium hover:bg-red-50"
                                            >
                                                Reject
                                            </button>
                                        </>
                                    )}
                                     {order.status === OrderStatus.ACCEPTED && (
                                        <button 
                                            onClick={() => handleOrder(order.id, OrderStatus.IN_DELIVERY)}
                                            className="bg-system-blue text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-blue-600"
                                        >
                                            Ship Order
                                        </button>
                                    )}
                                    {order.status === OrderStatus.IN_DELIVERY && (
                                        <button 
                                            onClick={() => handleOrder(order.id, OrderStatus.COMPLETED)}
                                            className="bg-system-green text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-green-600"
                                        >
                                            Complete Order
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {orders.length === 0 && <p className="text-center py-10 text-system-textSec">No orders yet.</p>}
            </div>
        </div>
    );
}

function TeamManagement() {
    const { user } = useApp();
    const [companyUsers, setCompanyUsers] = useState<any[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', role: UserRole.SUPPLIER_MANAGER });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Only allow access for Supplier Owner
    if (user?.role !== UserRole.SUPPLIER_OWNER) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-system-textSec">
                <span className="text-4xl mb-4">🚫</span>
                <h2 className="text-xl font-semibold text-system-text">Access Denied</h2>
                <p className="mt-2">Only Supplier Owners can manage team members.</p>
            </div>
        );
    }

    useEffect(() => {
        loadCompanyUsers();
    }, []);

    const loadCompanyUsers = async () => {
        try {
            const users = await api.auth.getCompanyUsers();
            setCompanyUsers(users);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await api.auth.addCompanyUser(newUser);
            await loadCompanyUsers();
            setNewUser({ email: '', password: '', role: UserRole.SUPPLIER_MANAGER });
            setShowAddForm(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveUser = async (userId: number, userEmail: string) => {
        if (!confirm(`Are you sure you want to remove ${userEmail} from your company?`)) {
            return;
        }

        try {
            await api.auth.removeCompanyUser(userId);
            await loadCompanyUsers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const getRoleDisplayName = (role: UserRole) => {
        switch (role) {
            case UserRole.SUPPLIER_OWNER: return 'Owner';
            case UserRole.SUPPLIER_MANAGER: return 'Manager';
            case UserRole.SUPPLIER_SALES: return 'Sales Rep';
            default: return role;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-system-text tracking-tight">Team Management</h2>
                    <p className="text-system-textSec">Manage your company's team members</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-system-text text-white px-6 py-3 rounded-xl font-medium hover:bg-black transition-colors"
                >
                    Add Team Member
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Add User Form */}
            {showAddForm && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6">Add New Team Member</h3>
                    <form onSubmit={handleAddUser} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text outline-none focus:ring-2 focus:ring-system-blue"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    placeholder="team.member@company.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text outline-none focus:ring-2 focus:ring-system-blue"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="Minimum 8 characters"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">Role</label>
                            <select
                                className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text outline-none focus:ring-2 focus:ring-system-blue"
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                            >
                                <option value={UserRole.SUPPLIER_MANAGER}>Manager</option>
                                <option value={UserRole.SUPPLIER_SALES}>Sales Rep</option>
                            </select>
                        </div>
                        <div className="flex gap-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-system-text text-white px-6 py-3 rounded-xl font-medium hover:bg-black transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Adding...' : 'Add User'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setNewUser({ email: '', password: '', role: UserRole.SUPPLIER_MANAGER });
                                    setError('');
                                }}
                                className="bg-white border border-system-border text-system-textSec px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Team Members List */}
            <div className="bg-white rounded-3xl shadow-card border border-system-border/50 overflow-hidden">
                <div className="p-6 border-b border-system-border">
                    <h3 className="text-lg font-semibold text-system-text">Current Team Members</h3>
                </div>
                <div className="divide-y divide-system-border/50">
                    {companyUsers.map(teamUser => (
                        <div key={teamUser.id} className="p-6 flex items-center justify-between hover:bg-system-bg/30 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-system-blue/10 rounded-full flex items-center justify-center">
                                    <span className="text-system-blue font-semibold text-lg">
                                        {teamUser.email.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <div className="font-medium text-system-text">{teamUser.email}</div>
                                    <div className="text-sm text-system-textSec">{getRoleDisplayName(teamUser.role)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    teamUser.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {teamUser.is_active ? 'Active' : 'Inactive'}
                                </span>
                                {teamUser.role !== UserRole.SUPPLIER_OWNER && (
                                    <button
                                        onClick={() => handleRemoveUser(teamUser.id, teamUser.email)}
                                        className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {companyUsers.length === 0 && (
                    <div className="p-12 text-center text-system-textSec">
                        <span className="text-4xl mb-4 block">👥</span>
                        <p>No team members yet. Add some to get started!</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ComplaintsManagement() {
    const { user } = useApp();
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadComplaints();
        
        // Listen for real-time complaint updates
        window.addEventListener('complaint_update', loadComplaints);
        return () => window.removeEventListener('complaint_update', loadComplaints);
    }, []);

    const loadComplaints = async () => {
        try {
            const data = await api.getMyComplaints();
            setComplaints(data);
        } catch (error) {
            console.error('Failed to load complaints:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (complaintId: number) => {
        if (!confirm('Are you sure you want to mark this complaint as resolved?')) return;
        
        try {
            await api.complaint.resolve(complaintId);
            await loadComplaints();
        } catch (err: any) {
            alert(err.message || 'Failed to resolve complaint');
        }
    };

    const escalatedComplaints = complaints.filter(c => c.status === ComplaintStatus.ESCALATED);
    const allComplaints = complaints.filter(c => c.status !== ComplaintStatus.ESCALATED);

    if (loading) return <div>Loading complaints...</div>;

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">Complaint Management</h2>
                <p className="text-system-textSec">
                    {user?.role === UserRole.SUPPLIER_MANAGER 
                        ? "Review and resolve escalated customer complaints"
                        : "Overview of all customer complaints"}
                </p>
            </div>

            {/* Escalated Complaints (Manager Priority) */}
            {escalatedComplaints.length > 0 && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-red-200/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-system-red rounded-full animate-pulse"></span>
                        Escalated Complaints (Requires Manager Action)
                    </h3>
                    <div className="space-y-4">
                        {escalatedComplaints.map(complaint => (
                            <div key={complaint.id} className="p-5 bg-red-50 rounded-2xl border border-red-200">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-semibold text-system-text">Complaint #{complaint.id}</span>
                                        <p className="text-xs text-system-textSec mt-1">
                                            Order #{complaint.order_id}
                                            {complaint.created_by && ` • From User #${complaint.created_by}`}
                                            {complaint.handler_name && (
                                                <span className="block mt-1 text-red-700 font-medium">
                                                    Handler: {complaint.handler_name} ({complaint.handler_role})
                                                </span>
                                            )}
                                        </p>
                                        <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                            ESCALATED
                                        </span>
                                    </div>
                                    {user?.role === UserRole.SUPPLIER_MANAGER && (
                                        <button
                                            onClick={() => handleResolve(complaint.id)}
                                            className="bg-system-green text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600"
                                        >
                                            Resolve
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-system-text">{complaint.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All Other Complaints */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <h3 className="text-lg font-semibold text-system-text mb-6">All Complaints</h3>
                {allComplaints.length === 0 ? (
                    <p className="text-system-textSec text-sm">No complaints to display</p>
                ) : (
                    <div className="space-y-4">
                        {allComplaints.map(complaint => (
                            <div key={complaint.id} className="p-5 bg-system-bg rounded-2xl border border-system-border/50">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-semibold text-system-text">Complaint #{complaint.id}</span>
                                        <p className="text-xs text-system-textSec mt-1">
                                            Order #{complaint.order_id}
                                            {complaint.created_by && ` • From User #${complaint.created_by}`}
                                        </p>
                                        <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                                            complaint.status === ComplaintStatus.OPEN ? 'bg-yellow-100 text-yellow-700' :
                                            complaint.status === ComplaintStatus.RESOLVED ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                            {complaint.status}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm text-system-text">{complaint.description}</p>
                                {complaint.handler_name && (
                                    <p className="text-xs text-system-textSec mt-3">
                                        Handler: {complaint.handler_name} 
                                        <span className="ml-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                                            {complaint.handler_role === 'SUPPLIER_SALES' ? 'Sales Rep' : 'Manager'}
                                        </span>
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CompanySettings() {
    const { user, setUser } = useApp();
    const navigate = useNavigate();
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [companyName, setCompanyName] = useState('');
    const [isActive, setIsActive] = useState(true);

    const isOwner = user?.role === UserRole.SUPPLIER_OWNER;

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await api.auth.getCompanySettings();
            setCompany(data);
            setCompanyName(data.name || '');
            setIsActive(data.is_active ?? true);
        } catch (error) {
            console.error('Failed to load company settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!isOwner) {
            alert('Only company owners can modify settings');
            return;
        }
        
        if (!companyName.trim()) {
            alert('Company name cannot be empty');
            return;
        }

        try {
            await api.auth.updateCompanySettings({ name: companyName });
            alert('Settings saved successfully');
            loadSettings();
        } catch (err: any) {
            alert(err.message || 'Failed to save settings');
        }
    };

    const handleToggleActive = async () => {
        if (!isOwner) {
            alert('Only company owners can modify company status');
            return;
        }
        
        const newStatus = !isActive;
        const confirmMsg = newStatus 
            ? 'Activate company? All team members will be able to log in.'
            : 'Deactivate company? All team members will be unable to log in.';
        
        if (!confirm(confirmMsg)) return;

        try {
            await api.auth.updateCompanySettings({ is_active: newStatus });
            setIsActive(newStatus);
            alert(`Company ${newStatus ? 'activated' : 'deactivated'} successfully`);
            loadSettings();
        } catch (err: any) {
            alert(err.message || 'Failed to update company status');
        }
    };

    const handleDeleteCompany = async () => {
        if (!isOwner) {
            alert('Only company owners can delete the company');
            return;
        }
        
        if (!confirm('⚠️ DELETE COMPANY?\n\nThis will permanently delete your company and all associated data including:\n- All team members\n- All products\n- All orders\n- All links\n\nThis action CANNOT be undone!\n\nType "DELETE" in the next prompt to confirm.')) {
            return;
        }

        const confirmation = prompt('Type DELETE to confirm company deletion:');
        if (confirmation !== 'DELETE') {
            alert('Deletion cancelled');
            return;
        }

        try {
            await api.auth.deleteCompany();
            alert('Company deleted successfully. You will be logged out.');
            setUser(null);
            navigate('/login');
        } catch (err: any) {
            alert(err.message || 'Failed to delete company');
        }
    };

    if (loading) return <div>Loading settings...</div>;

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">Company Settings</h2>
                <p className="text-system-textSec">{isOwner ? 'Manage your company information and status' : 'View company information (read-only for managers)'}</p>
                {!isOwner && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-600">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Read-only access
                    </div>
                )}
            </div>

            {/* Company Information */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <h3 className="text-lg font-semibold text-system-text mb-6">Company Information</h3>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-system-text mb-2">
                            Company Name
                        </label>
                        <input
                            type="text"
                            value={companyName || company?.name || ''}
                            onChange={(e) => isOwner ? setCompanyName(e.target.value) : null}
                            disabled={!isOwner}
                            className={`w-full px-4 py-2 border border-system-border rounded-lg focus:outline-none ${
                                isOwner 
                                    ? 'focus:ring-2 focus:ring-system-blue' 
                                    : 'bg-gray-50 cursor-not-allowed opacity-60'
                            }`}
                            placeholder={loading ? 'Loading...' : 'Company name'}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-system-text mb-2">
                            Company Type
                        </label>
                        <div className="px-4 py-2 bg-system-bg rounded-lg text-system-textSec min-h-[42px] flex items-center">
                            {loading ? 'Loading...' : (company?.type || 'Not specified')}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-system-text mb-2">
                            KYB Status
                        </label>
                        <div className={`px-4 py-2 rounded-lg inline-block ${
                            company?.kyb_status ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                            {company?.kyb_status ? 'Verified' : 'Pending Verification'}
                        </div>
                    </div>

                    {isOwner && (
                        <button
                            onClick={handleSaveSettings}
                            className="bg-system-blue text-white px-6 py-2 rounded-lg hover:bg-blue-600"
                        >
                            Save Changes
                        </button>
                    )}
                </div>
            </div>

            {/* Company Status */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <h3 className="text-lg font-semibold text-system-text mb-6">Company Status</h3>
                <div className="space-y-6">
                    {isOwner ? (
                        <div className="flex items-center justify-between p-4 bg-system-bg rounded-lg">
                            <div>
                                <div className="font-medium text-system-text">Company Active</div>
                                <div className="text-sm text-system-textSec">
                                    {isActive 
                                        ? 'Company is active. All team members can log in.' 
                                        : 'Company is deactivated. No team members can log in.'}
                                </div>
                            </div>
                            <button
                                onClick={handleToggleActive}
                                className={`px-6 py-2 rounded-lg font-medium ${
                                    isActive 
                                        ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                                        : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                            >
                                {isActive ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 bg-system-bg rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-system-text">Current Status</div>
                                    <div className="text-sm text-system-textSec">
                                        {isActive 
                                            ? 'Company is currently active and operational.' 
                                            : 'Company is currently deactivated.'}
                                    </div>
                                </div>
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                    isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                    {isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="mt-3 text-xs text-system-textSec">
                                Contact company owner to modify settings
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Danger Zone - Owner Only */}
            {isOwner && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-red-200">
                    <h3 className="text-lg font-semibold text-red-600 mb-6">Danger Zone</h3>
                    <div className="space-y-4">
                        <div className="p-4 border border-red-200 rounded-lg">
                            <div className="font-medium text-system-text mb-2">Delete Company</div>
                            <div className="text-sm text-system-textSec mb-4">
                                Permanently delete your company and all associated data. This action cannot be undone.
                            </div>
                            <button
                                onClick={handleDeleteCompany}
                                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-medium"
                            >
                                Delete Company
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ConnectionManagement() {
    const { user } = useApp();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'connections' | 'blacklist'>('connections');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [connectionsData, blacklistData] = await Promise.all([
                api.getConnections(),
                api.getBlacklist()
            ]);
            setConnections(connectionsData);
            setBlacklist(blacklistData);
        } catch (error) {
            console.error('Failed to load connection data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBlockConsumer = async (consumerId: number, consumerName: string) => {
        const reason = prompt(`Block ${consumerName}?\n\nReason (optional):`);
        if (reason === null) return; // User cancelled

        try {
            await api.blockConsumer(consumerId, reason || undefined);
            await loadData();
            alert(`${consumerName} has been blocked successfully`);
        } catch (error: any) {
            alert(`Failed to block consumer: ${error.message}`);
        }
    };

    const handleUnblockConsumer = async (consumerId: number, consumerName: string) => {
        if (!confirm(`Unblock ${consumerName}?`)) return;

        try {
            await api.unblockConsumer(consumerId);
            await loadData();
            alert(`${consumerName} has been unblocked successfully`);
        } catch (error: any) {
            alert(`Failed to unblock consumer: ${error.message}`);
        }
    };

    const handleRemoveConnection = async (consumerId: number, consumerName: string) => {
        if (!confirm(`Completely remove connection with ${consumerName}?\n\nThis will delete the connection permanently. They can request to link again unless blocked.`)) return;

        try {
            await api.removeConnection(consumerId);
            await loadData();
            alert(`Connection with ${consumerName} has been removed`);
        } catch (error: any) {
            alert(`Failed to remove connection: ${error.message}`);
        }
    };

    if (loading) return <div>Loading connections...</div>;

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">Connection Management</h2>
                <p className="text-system-textSec">Manage your connections and blocked consumers</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-system-border">
                <button
                    onClick={() => setActiveTab('connections')}
                    className={`pb-2 px-4 font-medium border-b-2 transition-colors ${
                        activeTab === 'connections' 
                            ? 'border-system-blue text-system-blue' 
                            : 'border-transparent text-system-textSec hover:text-system-text'
                    }`}
                >
                    Connections ({connections.length})
                </button>
                <button
                    onClick={() => setActiveTab('blacklist')}
                    className={`pb-2 px-4 font-medium border-b-2 transition-colors ${
                        activeTab === 'blacklist' 
                            ? 'border-system-blue text-system-blue' 
                            : 'border-transparent text-system-textSec hover:text-system-text'
                    }`}
                >
                    Blacklist ({blacklist.length})
                </button>
            </div>

            {/* Connections Tab */}
            {activeTab === 'connections' && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6">Active Connections</h3>
                    {connections.length === 0 ? (
                        <p className="text-system-textSec">No connections found</p>
                    ) : (
                        <div className="space-y-4">
                            {connections.map(connection => (
                                <div key={connection.id} className="flex items-center justify-between p-4 border border-system-border rounded-lg">
                                    <div>
                                        <div className="font-semibold text-system-text">{connection.consumer_name}</div>
                                        <div className="text-sm text-system-textSec">
                                            Status: <span className={`font-medium ${
                                                connection.status === 'APPROVED' ? 'text-green-600' : 
                                                connection.status === 'PENDING' ? 'text-yellow-600' :
                                                'text-red-600'
                                            }`}>{connection.status}</span>
                                            {connection.is_blacklisted && (
                                                <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                                                    Blacklisted
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {!connection.is_blacklisted && (
                                            <button
                                                onClick={() => handleBlockConsumer(connection.consumer_id, connection.consumer_name)}
                                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                                            >
                                                Block
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRemoveConnection(connection.consumer_id, connection.consumer_name)}
                                            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Blacklist Tab */}
            {activeTab === 'blacklist' && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6">Blacklisted Companies</h3>
                    {blacklist.length === 0 ? (
                        <p className="text-system-textSec">No companies in blacklist</p>
                    ) : (
                        <div className="space-y-4">
                            {blacklist.map(entry => (
                                <div key={entry.id} className="p-4 border border-red-200 bg-red-50 rounded-lg">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="font-semibold text-system-text">{entry.consumer_name}</div>
                                            <div className="text-sm text-system-textSec mt-1">
                                                Blocked on: {new Date(entry.blocked_at).toLocaleString()}
                                            </div>
                                            {entry.blocker_email && (
                                                <div className="text-sm text-system-textSec">
                                                    Blocked by: {entry.blocker_email}
                                                </div>
                                            )}
                                            {entry.reason && (
                                                <div className="text-sm text-system-text mt-2">
                                                    Reason: {entry.reason}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleUnblockConsumer(entry.consumer_id, entry.consumer_name)}
                                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                        >
                                            Unblock
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}