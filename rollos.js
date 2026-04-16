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
            .from('zzzrollos')
            .select('*')
            .eq('activo', true)
            .order('tipo', { ascending: true }); // ordenado por tipo

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
            text: 'No se pudo cargar el inventario de rollos. Intente nuevamente.'
        });
    } finally {
        hideLoader();
    }
}

// Generate a display name dynamically from rollo attributes
function getRolloName(product) {
    return `Rollo ${product.tipo} ${product.ancho} x ${product.largo} (${product.mic} micrones) ${product.peso ? '- ' + product.peso : ''}`.trim();
}

function renderProducts() {
    productsGrid.innerHTML = '';
    
    // Apply filters and search
    let filtered = allProducts;
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.tipo === currentFilter);
    }

    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(p => {
            const nombreCompleto = getRolloName(p).toLowerCase();
            return nombreCompleto.includes(searchTerm) || p.codigo.toLowerCase().includes(searchTerm);
        });
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

        const nombre = getRolloName(product);
        const stockStatusClass = product.cantidad > 20 ? 'high' : (product.cantidad > 0 ? 'low' : 'out');
        const stockStatusText = product.cantidad > 0 ? `${product.cantidad} disponibles` : 'Sin stock';
        card.innerHTML = `
            <span class="product-label">${product.tipo || 'General'}</span>
            <div class="product-info">
                <div class="product-title">${nombre}</div>
                <div class="product-id">Código: ${product.codigo}</div>
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
    const categories = [...new Set(allProducts.map(p => p.tipo).filter(Boolean))];
    
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
    
    // New product details
    const tipo = document.getElementById('stockTipo').value.trim();
    const ancho = document.getElementById('stockAncho').value.trim();
    const mic = document.getElementById('stockMic').value.trim();
    const largo = document.getElementById('stockLargo').value.trim();
    const peso = document.getElementById('stockPeso').value.trim();

    if (!id || isNaN(cantidadToAdd) || cantidadToAdd < 1) {
        Swal.fire('Atención', 'El código y la cantidad a sumar (mínimo 1) son obligatorios.', 'warning');
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
            .from('zzzrollos')
            .select('*')
            .eq('codigo', id)
            .single();

        // Warning: PGRST116 means zero rows returned (product does not exist)
        if (fetchError && fetchError.code !== 'PGRST116') {
             throw fetchError;
        }

        let upsertData = {};

        if (existingData) {
            // Product EXISTS -> Add to cantidad
            // Ignore other fields to prevent accidental overwrites
            const newStock = existingData.cantidad + cantidadToAdd;
            
            upsertData = {
                ...existingData,
                cantidad: newStock
            };
            
        } else {
            // Product DOES NOT EXIST -> Create new
            if (!tipo || !ancho || !mic || !largo) {
                 Swal.fire('Atención', 'Para crear un nuevo rollo, debe completar Tipo, Ancho, Micrones y Largo.', 'warning');
                 return;
            }
            upsertData = {
                codigo: id,
                tipo: tipo,
                ancho: ancho,
                mic: mic,
                largo: largo,
                peso: peso || null,
                cantidad: cantidadToAdd,
                activo: true
            };
        }

        // Execute Upsert
        const { error: upsertError } = await supabaseClient
            .from('zzzrollos')
            .upsert(upsertData, { onConflict: 'codigo' });

        if (upsertError) throw upsertError;

        Swal.fire({
            icon: 'success',
            title: '¡Operación Exitosa!',
            text: existingData 
                ? `Se agregaron ${cantidadToAdd} unidades al rollo existente.`
                : `Se creó un nuevo rollo con ${cantidadToAdd} unidades en stock.`,
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
    let html = '<option value="">Seleccione un rollo...</option>';
    allProducts.forEach(product => {
        html += `<option value="${product.codigo}">${product.codigo} - ${getRolloName(product)}</option>`;
    });
    editIdSearch.innerHTML = html;

    // Update auto-complete datalist
    const dataList = document.getElementById('productList');
    if (dataList) {
        let dlHtml = '';
        allProducts.forEach(product => {
            dlHtml += `<option value="${product.codigo}">${getRolloName(product)}</option>`;
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

    const product = allProducts.find(p => p.codigo === selectedId);
    
    if (product) {
        editFields.disabled = false;
        document.getElementById('editTipo').value = product.tipo || '';
        document.getElementById('editAncho').value = product.ancho || '';
        document.getElementById('editMic').value = product.mic || '';
        document.getElementById('editLargo').value = product.largo || '';
        document.getElementById('editPeso').value = product.peso || '';
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
            tipo: document.getElementById('editTipo').value.trim(),
            ancho: document.getElementById('editAncho').value.trim(),
            mic: document.getElementById('editMic').value.trim(),
            largo: document.getElementById('editLargo').value.trim(),
            peso: document.getElementById('editPeso').value.trim() || null
        };

        const { error } = await supabaseClient
            .from('zzzrollos')
            .update(updateData)
            .eq('codigo', id);

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'Guardado',
            text: 'Detalles del rollo actualizados correctamente.',
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
        title: '¿Desactivar rollo?',
        text: "El rollo ya no aparecerá en el catálogo.",
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
                .from('zzzrollos')
                .update({ activo: false })
                .eq('codigo', id);

            if (error) throw error;

            Swal.fire('Desactivado', 'El rollo ha sido quitado del catálogo.', 'success');
            
            editFields.disabled = true;
            editForm.reset();
            await fetchProducts(); // Refresh UI
            
        } catch (error) {
            console.error('Error deactivating:', error);
            Swal.fire('Error', 'Hubo un problema al desactivar el rollo.', 'error');
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
            const product = allProducts.find(p => p.codigo === val);
            if (product) {
                document.getElementById('stockTipo').value = product.tipo || '';
                document.getElementById('stockAncho').value = product.ancho || '';
                document.getElementById('stockMic').value = product.mic || '';
                document.getElementById('stockLargo').value = product.largo || '';
                document.getElementById('stockPeso').value = product.peso || '';
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
