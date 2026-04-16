const supabaseUrl = "https://nkkyyqqqusodhwqvprik.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ra3l5cXFxdXNvZGh3cXZwcmlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjU1MDIsImV4cCI6MjA4ODYwMTUwMn0.Gs5bdRrv9HNViruVjr8mQl4Oh2Ei1Hyryr0vxpdPPhU";

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// State
let allProducts = [];
let currentFilter = 'all';

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const loader = document.getElementById('loader');
const emptyState = document.getElementById('emptyState');
const categoryFilters = document.getElementById('categoryFilters');
const searchInput = document.getElementById('searchInput');

// Forms
const stockForm = document.getElementById('stockForm');
const editForm = document.getElementById('editForm');
const editIdSearch = document.getElementById('editIdSearch');
const editFields = document.getElementById('editFields');
const btnDeactivate = document.getElementById('btnDeactivate');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    setupEventListeners();
});

// ==========================================
// CORE CATALOG FUNCTIONS
// ==========================================

async function fetchProducts() {
    try {
        showLoader();
        const { data, error } = await supabaseClient
            .from('zzzagronomia')
            .select('*')
            .eq('activo', true)
            .order('nombre', { ascending: true });

        if (error) throw error;

        allProducts = data || [];
        updateCategoryFilters();
        updateAdminSelectOptions();
        renderProducts();
    } catch (error) {
        console.error('Error fetching products:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo cargar el inventario. Intente nuevamente.'
        });
    } finally {
        hideLoader();
    }
}

function renderProducts() {
    productsGrid.innerHTML = '';
    
    // Apply filters and search
    let filtered = allProducts;
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.categoria === currentFilter);
    }

    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.nombre?.toLowerCase().includes(searchTerm) || 
            p.id.toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');

    filtered.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card fade-in';
        card.style.animationDelay = `${index * 0.05}s`;

        const stockStatusClass = product.stock_actual > 20 ? 'high' : (product.stock_actual > 0 ? 'low' : 'out');
        const stockStatusText = product.stock_actual > 0 ? `${product.stock_actual} disponibles` : 'Sin stock';
        card.innerHTML = `
            <span class="product-label">${product.categoria || 'General'}</span>
            <div class="product-info">
                <div class="product-title">${product.nombre || 'Producto sin nombre'}</div>
                <div class="product-id">ID: ${product.id}</div>
                <div class="product-stock">
                    <span class="stock-indicator ${stockStatusClass}"></span>
                    ${stockStatusText}
                </div>
            </div>
        `;
        productsGrid.appendChild(card);
    });
}

function updateCategoryFilters() {
    const categories = [...new Set(allProducts.map(p => p.categoria).filter(Boolean))];
    
    // Preserve the "Todos" button
    let html = '<button class="filter-btn active" data-filter="all">Todos</button>';
    
    categories.forEach(cat => {
        html += `<button class="filter-btn" data-filter="${cat}">${cat}</button>`;
    });

    categoryFilters.innerHTML = html;

    // Attach events to dynamically created buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active styling
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Set filter and render
            currentFilter = e.target.getAttribute('data-filter');
            renderProducts();
        });
    });
}

// ==========================================
// ADMIN PANEL FUNCTIONS
// ==========================================

async function processStockUpdate(e) {
    e.preventDefault();
    
    const id = document.getElementById('stockId').value.trim();
    const cantidadStr = document.getElementById('stockCantidad').value;
    const cantidadToAdd = parseInt(cantidadStr, 10);
    
    // Optional details for new product
    const nombre = document.getElementById('stockNombre').value.trim();
    const categoria = document.getElementById('stockCategoria').value.trim();

    if (!id || isNaN(cantidadToAdd) || cantidadToAdd < 1) {
        Swal.fire('Atención', 'El ID y la cantidad a sumar (mínimo 1) son obligatorios.', 'warning');
        return;
    }

    try {
        Swal.fire({
            title: 'Procesando...',
            text: 'Actualizando inventario.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // 1. Check if product exists
        const { data: existingData, error: fetchError } = await supabaseClient
            .from('zzzagronomia')
            .select('*')
            .eq('id', id)
            .single();

        // Warning: PGRST116 means zero rows returned (product does not exist)
        if (fetchError && fetchError.code !== 'PGRST116') {
             throw fetchError;
        }

        let upsertData = {};

        if (existingData) {
            // Product EXISTS -> Add to stock_actual
            // Ignore other fields to prevent accidental overwrites as per business rules
            const newStock = existingData.stock_actual + cantidadToAdd;
            
            upsertData = {
                ...existingData,
                stock_actual: newStock
            };
            
        } else {
            // Product DOES NOT EXIST -> Create new
            upsertData = {
                id: id,
                nombre: nombre || 'Producto Nuevo',
                categoria: categoria || 'General',
                precio: 0, // Hardcoded to satisfy DB constraint if any
                stock_inicial: cantidadToAdd,
                stock_actual: cantidadToAdd,
                activo: true
            };
        }

        // Execute Upsert
        const { error: upsertError } = await supabaseClient
            .from('zzzagronomia')
            .upsert(upsertData, { onConflict: 'id' });

        if (upsertError) throw upsertError;

        Swal.fire({
            icon: 'success',
            title: '¡Operación Exitosa!',
            text: existingData 
                ? `Se agregaron ${cantidadToAdd} unidades al producto existente.`
                : `Se creó un nuevo producto con ${cantidadToAdd} unidades en stock.`,
            timer: 2500,
            showConfirmButton: false
        });

        stockForm.reset();
        await fetchProducts(); // Refresh UI

    } catch (error) {
        console.error('Error updating stock:', error);
        Swal.fire('Error', 'No se pudo procesar la actualización de stock.', 'error');
    }
}

function updateAdminSelectOptions() {
    let html = '<option value="">Seleccione un producto...</option>';
    allProducts.forEach(product => {
        html += `<option value="${product.id}">${product.id} - ${product.nombre}</option>`;
    });
    editIdSearch.innerHTML = html;

    // Update auto-complete datalist
    const dataList = document.getElementById('productList');
    if (dataList) {
        let dlHtml = '';
        allProducts.forEach(product => {
            // Allows searching by name but inputs the ID
            dlHtml += `<option value="${product.id}">${product.nombre}</option>`;
        });
        dataList.innerHTML = dlHtml;
    }
}

function handleEditSelection(e) {
    const selectedId = e.target.value;
    
    if (!selectedId) {
        editFields.disabled = true;
        editForm.reset();
        editIdSearch.value = ""; // Clear
        return;
    }

    const product = allProducts.find(p => p.id === selectedId);
    
    if (product) {
        editFields.disabled = false;
        document.getElementById('editNombre').value = product.nombre || '';
        document.getElementById('editCategoria').value = product.categoria || '';
        document.getElementById('editDescripcion').value = product.descripcion || '';
    }
}

async function saveProductDetails(e) {
    e.preventDefault();
    
    const id = editIdSearch.value;
    if (!id) return;

    try {
        Swal.fire({
            title: 'Guardando...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const updateData = {
            nombre: document.getElementById('editNombre').value.trim(),
            categoria: document.getElementById('editCategoria').value.trim(),
            descripcion: document.getElementById('editDescripcion').value.trim()
        };

        const { error } = await supabaseClient
            .from('zzzagronomia')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'Guardado',
            text: 'Detalles del producto actualizados correctamente.',
            timer: 2000,
            showConfirmButton: false
        });

        editFields.disabled = true;
        editForm.reset();
        await fetchProducts(); // Refresh UI

    } catch (error) {
        console.error('Error saving details:', error);
        Swal.fire('Error', 'No se pudieron guardar los cambios.', 'error');
    }
}

async function deactivateProduct() {
    const id = editIdSearch.value;
    if (!id) return;

    const result = await Swal.fire({
        title: '¿Desactivar producto?',
        text: "El producto ya no aparecerá en el catálogo.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Sí, desactivar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Desactivando...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const { error } = await supabaseClient
                .from('zzzagronomia')
                .update({ activo: false })
                .eq('id', id);

            if (error) throw error;

            Swal.fire('Desactivado', 'El producto ha sido quitado del catálogo.', 'success');
            
            editFields.disabled = true;
            editForm.reset();
            await fetchProducts(); // Refresh UI
            
        } catch (error) {
            console.error('Error deactivating:', error);
            Swal.fire('Error', 'Hubo un problema al desactivar el producto.', 'error');
        }
    }
}


// ==========================================
// UTILS & LISTENERS
// ==========================================

function setupEventListeners() {
    searchInput.addEventListener('input', renderProducts);
    
    const stockId = document.getElementById('stockId');
    if (stockId) {
        stockId.addEventListener('input', (e) => {
            const val = e.target.value;
            const product = allProducts.find(p => p.id === val);
            if (product) {
                document.getElementById('stockNombre').value = product.nombre || '';
                document.getElementById('stockCategoria').value = product.categoria || '';
            }
        });
    }

    stockForm.addEventListener('submit', processStockUpdate);
    editIdSearch.addEventListener('change', handleEditSelection);
    editForm.addEventListener('submit', saveProductDetails);
    btnDeactivate.addEventListener('click', deactivateProduct);
}

function showLoader() {
    loader.classList.remove('hidden');
    productsGrid.classList.add('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
    productsGrid.classList.remove('hidden');
}
