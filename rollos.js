const supabaseUrl = "https://nkkyyqqqusodhwqvprik.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ra3l5cXFxdXNvZGh3cXZwcmlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjU1MDIsImV4cCI6MjA4ODYwMTUwMn0.Gs5bdRrv9HNViruVjr8mQl4Oh2Ei1Hyryr0vxpdPPhU";

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// State
let allProducts = [];
let currentFilter = 'all';

const productsTableBody = document.getElementById('productsTableBody');
const multiSearchInputsBody = document.getElementById('multiSearchInputsBody');
const btnAddSearchRow = document.getElementById('btnAddSearchRow');
const btnMultiSearch = document.getElementById('btnMultiSearch');
const multiSearchResults = document.getElementById('multiSearchResults');
const multiSearchTableBody = document.getElementById('multiSearchTableBody');
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
// EXCEL-LIKE ACTIONS
// ==========================================

async function addStockPrompt(codigo) {
    const { value: quantityStr } = await Swal.fire({
        title: `Sumar stock`,
        text: `Rollo: ${codigo}`,
        input: 'number',
        inputLabel: 'Cantidad a sumar',
        inputPlaceholder: 'Ej: 10',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#dc2626',
        confirmButtonText: 'Sumar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value || parseInt(value) < 1) {
                return 'Debes ingresar un número válido (mínimo 1)'
            }
        }
    });

    if (quantityStr) {
        const cantidadToAdd = parseInt(quantityStr, 10);
        
        try {
            Swal.fire({
                title: 'Procesando...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const product = allProducts.find(p => p.codigo === codigo);
            if(!product) throw new Error("Rollo no encontrado en memoria");

            const newStock = product.cantidad + cantidadToAdd;

            const { error: updateError } = await supabaseClient
                .from('zzzrollos')
                .update({ cantidad: newStock })
                .eq('codigo', codigo);

            if (updateError) throw updateError;

            Swal.fire({
                icon: 'success',
                title: 'Stock Actualizado',
                text: `Se agregaron ${cantidadToAdd} unidades a ${codigo}.`,
                timer: 2000,
                showConfirmButton: false
            });

            await fetchProducts();
        } catch (error) {
            console.error('Error updating stock:', error);
            Swal.fire('Error', 'No se pudo actualizar el stock.', 'error');
        }
    }
}

async function editProductPrompt(codigo) {
    const product = allProducts.find(p => p.codigo === codigo);
    if (!product) return;
    
    const { value: formValues } = await Swal.fire({
        title: 'Editar Rollo',
        html: `
            <div style="display:flex; flex-direction:column; gap:10px; text-align:left;">
                <label style="font-size:14px; font-weight:bold;">Tipo</label>
                <input id="swal-input-tipo" class="swal2-input" style="margin:0; width:100%;" placeholder="Tipo" value="${product.tipo || ''}">
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;"><label style="font-size:14px; font-weight:bold; margin-top:10px;">Ancho</label>
                    <input id="swal-input-ancho" class="swal2-input" style="margin:0; width:100%;" placeholder="Ancho" value="${product.ancho || ''}"></div>
                    <div style="flex:1;"><label style="font-size:14px; font-weight:bold; margin-top:10px;">Micrones</label>
                    <input id="swal-input-mic" class="swal2-input" style="margin:0; width:100%;" placeholder="Micrones" value="${product.mic || ''}"></div>
                </div>
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;"><label style="font-size:14px; font-weight:bold; margin-top:10px;">Largo</label>
                    <input id="swal-input-largo" class="swal2-input" style="margin:0; width:100%;" placeholder="Largo" value="${product.largo || ''}"></div>
                    <div style="flex:1;"><label style="font-size:14px; font-weight:bold; margin-top:10px;">Peso</label>
                    <input id="swal-input-peso" class="swal2-input" style="margin:0; width:100%;" placeholder="Peso" value="${product.peso || ''}"></div>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#dc2626',
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return {
                tipo: document.getElementById('swal-input-tipo').value.trim(),
                ancho: document.getElementById('swal-input-ancho').value.trim(),
                mic: document.getElementById('swal-input-mic').value.trim(),
                largo: document.getElementById('swal-input-largo').value.trim(),
                peso: document.getElementById('swal-input-peso').value.trim()
            }
        }
    });

    if (formValues) {
        try {
            Swal.fire({
                title: 'Guardando...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const { error: updateError } = await supabaseClient
                .from('zzzrollos')
                .update({ 
                    tipo: formValues.tipo,
                    ancho: formValues.ancho,
                    mic: formValues.mic,
                    largo: formValues.largo,
                    peso: formValues.peso || null
                })
                .eq('codigo', codigo);

            if (updateError) throw updateError;

            Swal.fire({
                icon: 'success',
                title: 'Guardado',
                text: 'Detalles del rollo actualizados correctamente.',
                timer: 2000,
                showConfirmButton: false
            });

            await fetchProducts();
        } catch (error) {
            console.error('Error saving details:', error);
            Swal.fire('Error', 'No se pudieron guardar los cambios.', 'error');
        }
    }
}

function searchMultipleProducts() {
    const inputs = document.querySelectorAll('.multi-search-input');
    const tokens = [];
    
    inputs.forEach(input => {
        const val = input.value.trim();
        if (val) tokens.push(val);
    });

    if (tokens.length === 0) return;

    // search all products for matches
    const results = allProducts.filter(p => {
        return tokens.some(token => {
            const lowerToken = token.toLowerCase();
            const nombreCompleto = getRolloName(p).toLowerCase();
            return p.codigo.toLowerCase() === lowerToken || nombreCompleto.includes(lowerToken);
        });
    });

    // render results
    multiSearchTableBody.innerHTML = '';
    
    if (results.length === 0) {
        multiSearchTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No se encontraron resultados</td></tr>';
    } else {
        results.forEach(product => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${product.codigo}</td>
                <td>${getRolloName(product)}</td>
                <td><strong>${product.cantidad}</strong></td>
            `;
            multiSearchTableBody.appendChild(tr);
        });
    }

    multiSearchResults.classList.remove('hidden');
}

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
    if (!productsTableBody) return;
    productsTableBody.innerHTML = '';
    
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
        productsTableBody.parentElement.parentElement.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    productsTableBody.parentElement.parentElement.classList.remove('hidden');

    filtered.forEach((product, index) => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.style.animationDelay = `${(index % 10) * 0.02}s`; // Limit animation delay slightly
        
        const nombre = getRolloName(product);
        
        tr.innerHTML = `
            <td>${product.codigo}</td>
            <td>${nombre}</td>
            <td style="font-weight: 600; color: ${product.cantidad > 0 ? (product.cantidad > 20 ? 'inherit' : '#eab308') : '#ef4444'};">
                ${product.cantidad}
            </td>
            <td>
                <button class="action-btn btn-add" onclick="addStockPrompt('${product.codigo}')" title="Sumar Stock"><i class="fa-solid fa-plus"></i></button>
                <button class="action-btn btn-edit" onclick="editProductPrompt('${product.codigo}')" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
            </td>
        `;
        productsTableBody.appendChild(tr);
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
    if (searchInput) searchInput.addEventListener('input', renderProducts);
    if (btnMultiSearch) btnMultiSearch.addEventListener('click', searchMultipleProducts);
    if (btnAddSearchRow) {
        btnAddSearchRow.addEventListener('click', () => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" class="multi-search-input" list="productList" placeholder="Escribe para autocompletar..." style="width: 100%; background: var(--clr-bg-light); border: 1px solid var(--clr-admin-border); color: white; padding: 0.5rem; border-radius: 4px; outline: none;"></td>
                <td><button type="button" class="action-btn btn-danger" onclick="this.closest('tr').remove()" style="margin: 0; padding: 0.25rem 0.5rem; color: #ef4444;"><i class="fa-solid fa-trash"></i></button></td>
            `;
            multiSearchInputsBody.appendChild(tr);
        });
    }
    
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

    if (stockForm) stockForm.addEventListener('submit', processStockUpdate);
    if (editIdSearch) editIdSearch.addEventListener('change', handleEditSelection);
    if (editForm) editForm.addEventListener('submit', saveProductDetails);
    if (btnDeactivate) btnDeactivate.addEventListener('click', deactivateProduct);
}

function showLoader() {
    if(loader) loader.classList.remove('hidden');
    if(productsTableBody && productsTableBody.parentElement) {
        productsTableBody.parentElement.parentElement.classList.add('hidden');
    }
}

function hideLoader() {
    if(loader) loader.classList.add('hidden');
    if(productsTableBody && productsTableBody.parentElement) {
        productsTableBody.parentElement.parentElement.classList.remove('hidden');
    }
}
