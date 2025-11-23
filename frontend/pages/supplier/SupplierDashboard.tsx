import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, NavLink as RouterNavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, resolveImageUrl } from '../../services/api';
import { Link, LinkStatus, Order, OrderStatus, Product, UserRole, Complaint, ComplaintStatus, Company, Connection, BlacklistEntry } from '../../types';
import { useApp } from '../../App';
import LanguageSwitcher from '../../components/LanguageSwitcher';

const panelBase = 'rounded-3xl border border-system-border/40 bg-white/90 backdrop-blur-md shadow-[0_28px_80px_-36px_rgba(15,23,42,0.45)]';
const panelPadding = 'p-6 md:p-8';
const panelClass = `${panelBase} ${panelPadding}`;

const supplierNavItems = [
    { key: 'supplier.overview', to: '/supplier', exact: true },
    { key: 'common.products', to: '/supplier/products' },
    { key: 'common.orders', to: '/supplier/orders' },
    { key: 'common.complaints', to: '/supplier/complaints' },
    { key: 'supplier.team', to: '/supplier/team' },
    { key: 'supplier.connections', to: '/supplier/connections' },
    { key: 'common.settings', to: '/supplier/settings' },
];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'KZT',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value).replace('KZT', '₸');
};

export default function SupplierDashboard() {
    const { t } = useTranslation();
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
        if (item.key === 'supplier.team' && user?.role !== UserRole.SUPPLIER_OWNER) {
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
                            <h2 className="text-lg font-semibold text-system-text">{t('common.dashboard')}</h2>
                            <p className="text-xs text-system-textSec hidden sm:block">{t('supplier.controlCenter')}</p>
                        </div>
                        <nav className="flex items-center gap-1">
                            {visibleNavItems.map(item => (
                                <RouterNavLink
                                    key={item.key}
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
                                    {t(item.key)}
                                </RouterNavLink>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <LanguageSwitcher />
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
                            {t('common.logout')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
                <header className="text-center">
                    <h1 className="text-3xl font-bold text-system-text tracking-tight">{t('supplier.dashboardTitle')}</h1>
                    <p className="mt-2 max-w-2xl mx-auto text-sm text-system-textSec">
                        {t('supplier.dashboardSubtitle')}
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
    const { t } = useTranslation();
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
            label: t('supplier.activeConsumers'),
            value: activeLinks.length.toLocaleString(),
            caption: t('supplier.activeConsumersCaption')
        },
        {
            label: t('supplier.openOrders'),
            value: pipelineOrders.length.toLocaleString(),
            caption: t('supplier.openOrdersCaption')
        },
        {
            label: t('supplier.revenueLifetime'),
            value: formatCurrency(totalRevenue),
            caption: t('supplier.completedOrdersCaption', { count: completedOrders.length })
        },
        {
            label: t('supplier.catalogItems'),
            value: products.length.toLocaleString(),
            caption: outOfStock ? t('supplier.outOfStock', { count: outOfStock }) : t('supplier.allItemsAvailable')
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
                title={t('supplier.dailyPulse')}
                subtitle={t('supplier.dailyPulseSubtitle')}
                actions={
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                        {t('supplier.ordersInMotion', { count: pipelineOrders.length })}
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
                            <h3 className="text-lg font-semibold text-system-text">{t('supplier.pendingConnectionRequests')}</h3>
                            <p className="text-sm text-system-textSec">{t('supplier.pendingConnectionRequestsSubtitle')}</p>
                        </div>
                        <span className="rounded-full bg-system-blue/10 px-3 py-1 text-xs font-semibold text-system-blue">{pendingLinks.length}</span>
                    </div>

                    {pendingLinks.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-system-border/70 bg-system-bg px-6 py-10 text-center text-sm text-system-textSec">
                            {t('supplier.noPendingRequests')}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingLinks.map(link => (
                                <div key={link.id} className="flex flex-col gap-4 rounded-2xl border border-system-border/70 bg-system-bg p-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="font-semibold text-system-text">{t('supplier.consumer')} #{link.consumer_id}</p>
                                        <p className="text-xs text-system-textSec">{t('supplier.requestId')}: {link.id}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            className="rounded-full bg-system-text px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                                            onClick={() => handleStatusChange(link.id, LinkStatus.APPROVED)}
                                        >
                                            {t('supplier.approve')}
                                        </button>
                                        <button
                                            className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                                            onClick={() => handleStatusChange(link.id, LinkStatus.REJECTED)}
                                        >
                                            {t('supplier.reject')}
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
                            <h3 className="text-lg font-semibold text-system-text">{t('supplier.orderPipeline')}</h3>
                            <p className="text-sm text-system-textSec">{t('supplier.orderPipelineSubtitle')}</p>
                        </div>
                        <RouterNavLink
                            to="/supplier/orders"
                            className="text-xs font-semibold text-system-blue transition-colors hover:text-blue-600"
                        >
                            {t('supplier.viewAllOrders')} →
                        </RouterNavLink>
                    </div>

                    {pipelineOrders.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-system-border/70 bg-system-bg px-6 py-10 text-center text-sm text-system-textSec">
                            {t('supplier.noOrdersInProgress')}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pipelineOrders.slice(0, 4).map(order => (
                                <div key={order.id} className="flex flex-col gap-3 rounded-2xl border border-system-border/70 bg-system-bg p-4 md:flex-row md:items-center md:justify-between">
                                    <div className="space-y-1">
                                        <p className="font-semibold text-system-text">{t('supplier.order')} #{order.id}</p>
                                        <p className="text-xs text-system-textSec">{t('supplier.consumer')} #{order.consumer_id} • {order.items.length} {t('supplier.items')}</p>
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
                        <h3 className="text-lg font-semibold text-system-text">{t('supplier.inventorySignals')}</h3>
                        <p className="text-sm text-system-textSec">{t('supplier.inventorySignalsSubtitle')}</p>
                    </div>
                    <RouterNavLink
                        to="/supplier/products"
                        className="text-xs font-semibold text-system-blue transition-colors hover:text-blue-600"
                    >
                        {t('supplier.manageProducts')} →
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
                                {t('supplier.stockHealthy')}
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
                                        <p className="text-xs text-system-textSec">{t('supplier.sku')} {product.sku}</p>
                                        <p className="mt-1 text-xs font-semibold text-system-red">
                                            {product.stock_quantity} {t('supplier.inStock')} • {t('supplier.minOrder')} {product.min_order_qty}
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
                            <p className="font-semibold text-system-text">{t('supplier.averageOrderValue')}</p>
                            <p className="text-sm text-system-textSec">{t('supplier.completedOrdersOnly')}</p>
                        </div>
                        <p className="text-2xl font-semibold text-system-text">{averageOrderValue ? formatCurrency(averageOrderValue) : '—'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Inventory() {
    const { t } = useTranslation();
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

    const handleDelete = async (productId: number) => {
        if (!canEdit) return;
        if (!window.confirm(t('supplier.confirmDeleteProduct'))) return;

        try {
            await api.deleteProduct(productId);
            setProducts(await api.getProducts());
            alert(t('supplier.productDeleted'));
        } catch (error: any) {
            alert('Failed to delete product: ' + (error.message || 'Unknown error'));
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
                title={t('supplier.catalogManagement')}
                subtitle={t('supplier.catalogManagementSubtitle')}
                actions={
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-600">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {t('supplier.liveProducts', { count: products.filter(p => p.is_active).length })}
                    </div>
                }
            />

            {canEdit && (
                <div className={`${panelClass} space-y-6`}>
                    <div>
                        <h3 className="text-xl font-semibold text-system-text">{t('supplier.addNewProduct')}</h3>
                        <p className="text-sm text-system-textSec">{t('supplier.addNewProductSubtitle')}</p>
                    </div>
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-system-textSec">{t('supplier.productName')}</label>
                                <input
                                    className="w-full rounded-2xl border border-system-border/60 bg-system-bg px-4 py-3 text-sm outline-none transition focus:border-system-blue focus:ring-2 focus:ring-system-blue/20"
                                    value={newProd.name}
                                    onChange={e => setNewProd({ ...newProd, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-system-textSec">{t('supplier.sku')}</label>
                                <input
                                    className="w-full rounded-2xl border border-system-border/60 bg-system-bg px-4 py-3 text-sm outline-none transition focus:border-system-blue focus:ring-2 focus:ring-system-blue/20"
                                    value={newProd.sku}
                                    onChange={e => setNewProd({ ...newProd, sku: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-system-textSec">{t('common.price')} (₸)</label>
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
                                <label className="text-xs font-semibold uppercase text-system-textSec">{t('supplier.stock')}</label>
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
                                <label className="text-xs font-semibold uppercase text-system-textSec">{t('supplier.minOrderQty')}</label>
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
                                <label className="text-xs font-semibold uppercase text-system-textSec">{t('supplier.productImage')}</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-system-textSec file:mr-4 file:rounded-full file:border-0 file:bg-system-blue/10 file:px-5 file:py-2 file:font-semibold file:text-system-blue hover:file:bg-system-blue/20"
                                />
                                {imageFile && <p className="text-xs text-system-textSec">{t('supplier.selected')}: {imageFile.name}</p>}
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="rounded-xl bg-system-text px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black">{t('supplier.addProduct')}</button>
                        </div>
                    </form>
                </div>
            )}

            <div className={`${panelBase} overflow-hidden`}>
                <div className="border-b border-system-border/60 bg-system-bg/60 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-system-text md:px-8">
                    {t('supplier.productCatalog')}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm">
                        <thead>
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">{t('supplier.image')}</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">{t('supplier.sku')}</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">{t('supplier.name')}</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">{t('common.price')}</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">{t('supplier.stock')}</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">{t('common.status')}</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">{t('supplier.minOrder')}</th>
                                {canEdit && <th className="px-6 py-4 text-xs font-semibold uppercase text-system-textSec md:px-8">{t('supplier.actions')}</th>}
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
                                                {editImageFile && <p className="text-[10px] text-system-textSec">{t('common.newFile')}: {editImageFile.name}</p>}
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
                                                (editForm.stock_quantity ?? 0) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                <span className={`h-2 w-2 rounded-full ${(editForm.stock_quantity ?? 0) > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                {(editForm.stock_quantity ?? 0) > 0 ? t('supplier.willBeActive') : t('supplier.willBeInactive')}
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
                                                <button onClick={() => handleSaveEdit(product.id)} className="rounded-xl bg-system-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-600">{t('common.save')}</button>
                                                <button onClick={handleCancelEdit} className="rounded-xl bg-system-textSec px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-600">{t('common.cancel')}</button>
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
                                        <td className="px-6 py-5 text-system-text md:px-8">₸{product.price.toFixed(2)}</td>
                                        <td className="px-6 py-5 text-system-text md:px-8">{product.stock_quantity}</td>
                                        <td className="px-6 py-5 md:px-8">
                                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                                product.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-system-textSec'
                                            }`}>
                                                <span className={`h-2 w-2 rounded-full ${product.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                {product.is_active ? t('supplier.active') : t('supplier.inactive')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-system-text md:px-8">{product.min_order_qty ?? '—'}</td>
                                        {canEdit && (
                                            <td className="px-6 py-5 md:px-8">
                                                <div className="flex gap-3">
                                                    <button onClick={() => handleEdit(product)} className="text-sm font-semibold text-system-blue transition-colors hover:text-blue-600">{t('common.edit')}</button>
                                                    <button onClick={() => handleDelete(product.id)} className="text-sm font-semibold text-red-500 transition-colors hover:text-red-600">{t('common.delete')}</button>
                                                </div>
                                            </td>
                                        )}
                                    </>
                                )}
                            </tr>
                        ))}
                        {products.length === 0 && (
                            <tr>
                                <td colSpan={canEdit ? 8 : 7} className="px-6 py-12 text-center text-sm text-system-textSec md:px-8">
                                    {t('supplier.noProductsYet')}
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
    const { t } = useTranslation();
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
            <h2 className="text-2xl font-bold text-system-text tracking-tight">{t('supplier.incomingOrders')}</h2>
            <div className="space-y-4">
                {orders.map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50 hover:shadow-lg transition-shadow">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-bold text-lg text-system-text">{t('supplier.order')} #{order.id}</span>
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
                                <p className="text-sm text-system-textSec">{t('supplier.consumer')} ID: {order.consumer_id} • {order.items.length} {t('supplier.items')}</p>
                            </div>
                            
                            <div className="text-right">
                                <p className="font-bold text-xl text-system-text">₸{order.total_amount.toFixed(2)}</p>
                                <div className="flex gap-3">
                                    {order.status === OrderStatus.PENDING && (
                                        <>
                                            <button 
                                                onClick={() => handleOrder(order.id, OrderStatus.ACCEPTED)}
                                                className="bg-system-text text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-black"
                                            >
                                                {t('supplier.accept')}
                                            </button>
                                            <button 
                                                onClick={() => handleOrder(order.id, OrderStatus.REJECTED)}
                                                className="bg-white border border-system-border text-system-red px-5 py-2 rounded-full text-sm font-medium hover:bg-red-50"
                                            >
                                                {t('supplier.reject')}
                                            </button>
                                        </>
                                    )}
                                     {order.status === OrderStatus.ACCEPTED && (
                                        <button 
                                            onClick={() => handleOrder(order.id, OrderStatus.IN_DELIVERY)}
                                            className="bg-system-blue text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-blue-600"
                                        >
                                            {t('supplier.shipOrder')}
                                        </button>
                                    )}
                                    {order.status === OrderStatus.IN_DELIVERY && (
                                        <button 
                                            onClick={() => handleOrder(order.id, OrderStatus.COMPLETED)}
                                            className="bg-system-green text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-green-600"
                                        >
                                            {t('supplier.completeOrder')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {orders.length === 0 && <p className="text-center py-10 text-system-textSec">{t('supplier.noOrdersYet')}</p>}
            </div>
        </div>
    );
}

function TeamManagement() {
    const { t } = useTranslation();
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
                <h2 className="text-xl font-semibold text-system-text">{t('supplier.accessDenied')}</h2>
                <p className="mt-2">{t('supplier.accessDeniedMessage')}</p>
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
            case UserRole.SUPPLIER_OWNER: return t('login.supplierOwner');
            case UserRole.SUPPLIER_MANAGER: return t('login.supplierManager');
            case UserRole.SUPPLIER_SALES: return t('login.supplierSales');
            default: return role;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-system-text tracking-tight">{t('supplier.teamManagement')}</h2>
                    <p className="text-system-textSec">{t('supplier.teamManagementSubtitle')}</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-system-text text-white px-6 py-3 rounded-xl font-medium hover:bg-black transition-colors"
                >
                    {t('supplier.addTeamMember')}
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
                    <h3 className="text-lg font-semibold text-system-text mb-6">{t('supplier.addNewTeamMember')}</h3>
                    <form onSubmit={handleAddUser} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">{t('login.email')}</label>
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
                                <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">{t('login.password')}</label>
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
                            <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">{t('login.role')}</label>
                            <select
                                className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text outline-none focus:ring-2 focus:ring-system-blue"
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                            >
                                <option value={UserRole.SUPPLIER_MANAGER}>{t('login.supplierManager')}</option>
                                <option value={UserRole.SUPPLIER_SALES}>{t('login.supplierSales')}</option>
                            </select>
                        </div>
                        <div className="flex gap-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-system-text text-white px-6 py-3 rounded-xl font-medium hover:bg-black transition-colors disabled:opacity-50"
                            >
                                {loading ? t('supplier.adding') : t('supplier.addUser')}
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
                                {t('common.cancel')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Team Members List */}
            <div className="bg-white rounded-3xl shadow-card border border-system-border/50 overflow-hidden">
                <div className="p-6 border-b border-system-border">
                    <h3 className="text-lg font-semibold text-system-text">{t('supplier.currentTeamMembers')}</h3>
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
                                    {teamUser.is_active ? t('supplier.active') : t('supplier.inactive')}
                                </span>
                                {teamUser.role !== UserRole.SUPPLIER_OWNER && (
                                    <button
                                        onClick={() => handleRemoveUser(teamUser.id, teamUser.email)}
                                        className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                                    >
                                        {t('supplier.remove')}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {companyUsers.length === 0 && (
                    <div className="p-12 text-center text-system-textSec">
                        <span className="text-4xl mb-4 block">👥</span>
                        <p>{t('supplier.noTeamMembers')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ComplaintsManagement() {
    const { t } = useTranslation();
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

    if (loading) return <div>{t('common.loading')}</div>;

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">{t('supplier.complaintManagement')}</h2>
                <p className="text-system-textSec">
                    {user?.role === UserRole.SUPPLIER_MANAGER 
                        ? t('supplier.complaintManagementManager')
                        : t('supplier.complaintManagementStaff')}
                </p>
            </div>

            {/* Escalated Complaints (Manager Priority) */}
            {escalatedComplaints.length > 0 && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-red-200/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-system-red rounded-full animate-pulse"></span>
                        {t('supplier.escalatedComplaints')}
                    </h3>
                    <div className="space-y-4">
                        {escalatedComplaints.map(complaint => (
                            <div key={complaint.id} className="p-5 bg-red-50 rounded-2xl border border-red-200">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-semibold text-system-text">{t('common.complaints')} #{complaint.id}</span>
                                        <p className="text-xs text-system-textSec mt-1">
                                            {t('supplier.order')} #{complaint.order_id}
                                            {complaint.created_by && ` • ${t('supplier.fromUser')} #${complaint.created_by}`}
                                            {complaint.handler_name && (
                                                <span className="block mt-1 text-red-700 font-medium">
                                                    {t('supplier.handler')}: {complaint.handler_name} ({complaint.handler_role})
                                                </span>
                                            )}
                                        </p>
                                        <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                            {t('supplier.escalated')}
                                        </span>
                                    </div>
                                    {user?.role === UserRole.SUPPLIER_MANAGER && (
                                        <button
                                            onClick={() => handleResolve(complaint.id)}
                                            className="bg-system-green text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600"
                                        >
                                            {t('supplier.resolve')}
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
                <h3 className="text-lg font-semibold text-system-text mb-6">{t('supplier.allComplaints')}</h3>
                {allComplaints.length === 0 ? (
                    <p className="text-system-textSec text-sm">{t('supplier.noComplaints')}</p>
                ) : (
                    <div className="space-y-4">
                        {allComplaints.map(complaint => (
                            <div key={complaint.id} className="p-5 bg-system-bg rounded-2xl border border-system-border/50">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-semibold text-system-text">{t('common.complaints')} #{complaint.id}</span>
                                        <p className="text-xs text-system-textSec mt-1">
                                            {t('supplier.order')} #{complaint.order_id}
                                            {complaint.created_by && ` • ${t('supplier.fromUser')} #${complaint.created_by}`}
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
                                        {t('supplier.handler')}: {complaint.handler_name} 
                                        <span className="ml-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                                            {complaint.handler_role === 'SUPPLIER_SALES' ? t('login.supplierSales') : t('login.supplierManager')}
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
    const { t } = useTranslation();
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
            api.logout();
            setUser(null);
            navigate('/login');
        } catch (err: any) {
            alert(err.message || 'Failed to delete company');
        }
    };

    if (loading) return <div>{t('common.loading')}</div>;

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">{t('supplier.companySettings')}</h2>
                <p className="text-system-textSec">{isOwner ? t('supplier.manageCompanyProfile') : t('supplier.viewCompanyProfile')}</p>
                {!isOwner && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-600">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        {t('supplier.readOnlyAccess')}
                    </div>
                )}
            </div>

            {/* Company Information */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <h3 className="text-lg font-semibold text-system-text mb-6">{t('supplier.companyInformation')}</h3>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-system-text mb-2">
                            {t('supplier.companyName')}
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
                            placeholder={loading ? t('common.loading') : t('supplier.companyName')}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-system-text mb-2">
                            {t('supplier.companyType')}
                        </label>
                        <div className="px-4 py-2 bg-system-bg rounded-lg text-system-textSec min-h-[42px] flex items-center">
                            {loading ? t('common.loading') : (company?.type || t('common.notSpecified'))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-system-text mb-2">
                            {t('supplier.kybStatus')}
                        </label>
                        <div className={`px-4 py-2 rounded-lg inline-block ${
                            company?.kyb_status ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                            {company?.kyb_status ? t('supplier.verified') : t('supplier.pendingVerification')}
                        </div>
                    </div>

                    {isOwner && (
                        <button
                            onClick={handleSaveSettings}
                            className="bg-system-blue text-white px-6 py-2 rounded-lg hover:bg-blue-600"
                        >
                            {t('common.saveChanges')}
                        </button>
                    )}
                </div>
            </div>

            {/* Company Status */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <h3 className="text-lg font-semibold text-system-text mb-6">{t('supplier.companyStatus')}</h3>
                <div className="space-y-6">
                    {isOwner ? (
                        <div className="flex items-center justify-between p-4 bg-system-bg rounded-lg">
                            <div>
                                <div className="font-medium text-system-text">{t('supplier.companyActive')}</div>
                                <div className="text-sm text-system-textSec">
                                    {isActive 
                                        ? t('supplier.companyActiveDesc') 
                                        : t('supplier.companyInactiveDesc')}
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
                                {isActive ? t('supplier.deactivate') : t('supplier.activate')}
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 bg-system-bg rounded-lg">
                            <div className="font-medium text-system-text">{t('supplier.companyActive')}</div>
                            <div className="text-sm text-system-textSec mt-1">
                                {isActive 
                                    ? t('supplier.companyActiveDesc') 
                                    : t('supplier.companyInactiveDesc')}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Danger Zone */}
            {isOwner && (
                <div className="bg-red-50 p-8 rounded-3xl border border-red-200">
                    <h3 className="text-lg font-semibold text-red-800 mb-6">{t('supplier.dangerZone')}</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-red-800">{t('supplier.deleteCompany')}</div>
                            <div className="text-sm text-red-600 mt-1">
                                {t('supplier.deleteCompanyDesc')}
                            </div>
                        </div>
                        <button
                            onClick={handleDeleteCompany}
                            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
                        >
                            {t('supplier.deleteCompany')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ConnectionManagement() {
    const { t } = useTranslation();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadConnections();
    }, []);

    const loadConnections = async () => {
        try {
            const data = await api.getMyLinks();
            // Map Link[] to Connection[] if necessary, or just use Link[]
            // Assuming Connection type is compatible or I should use Link type
            setConnections(data as unknown as Connection[]);
        } catch (err: any) {
            setError(err.message || t('common.errorLoadingData'));
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: number, status: 'active' | 'rejected') => {
        try {
            await api.updateLinkStatus(id, status);
            loadConnections();
        } catch (err: any) {
            alert(err.message || t('common.errorUpdatingStatus'));
        }
    };

    const pendingConnections = connections.filter(c => c.status === 'pending');
    const activeConnections = connections.filter(c => c.status === 'active');

    if (loading) return <div>{t('common.loading')}</div>;

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">{t('supplier.connectionManagement')}</h2>
                <p className="text-system-textSec">{t('supplier.connectionManagementSubtitle')}</p>
            </div>

            {/* Pending Requests */}
            {pendingConnections.length > 0 && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-blue-200/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-system-blue rounded-full animate-pulse"></span>
                        {t('supplier.pendingRequests')}
                    </h3>
                    <div className="space-y-4">
                        {pendingConnections.map(connection => (
                            <div key={connection.id} className="p-5 bg-blue-50 rounded-2xl border border-blue-200 flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-system-text">
                                        {connection.consumer_company_name || t('supplier.unknownCompany')}
                                    </div>
                                    <div className="text-sm text-system-textSec mt-1">
                                        {t('supplier.requestedOn')} {new Date(connection.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleStatusUpdate(connection.id, 'active')}
                                        className="bg-system-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors"
                                    >
                                        {t('supplier.accept')}
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(connection.id, 'rejected')}
                                        className="bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm hover:bg-blue-50 transition-colors"
                                    >
                                        {t('supplier.reject')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Connections */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <h3 className="text-lg font-semibold text-system-text mb-6">{t('supplier.activeConnections')}</h3>
                {activeConnections.length === 0 ? (
                    <p className="text-system-textSec text-sm">{t('supplier.noActiveConnections')}</p>
                ) : (
                    <div className="space-y-4">
                        {activeConnections.map(connection => (
                            <div key={connection.id} className="p-5 bg-system-bg rounded-2xl border border-system-border/50 flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-system-text">
                                        {connection.consumer_company_name || t('supplier.unknownCompany')}
                                    </div>
                                    <div className="text-sm text-system-textSec mt-1">
                                        {t('supplier.connectedSince')} {new Date(connection.updated_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                    {t('supplier.active')}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}