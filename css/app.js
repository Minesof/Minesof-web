document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginError = document.getElementById('loginError');

    const ALLOWED_ADMINS = ['minesof.oficial@gmail.com'];

    window.auth.onAuthStateChanged(user => {
        if (user) {
            // VERIFICACIÓN ESTRICTA EN EL FRONTEND
            if (!ALLOWED_ADMINS.includes(user.email.toLowerCase())) {
                window.auth.signOut();
                loginError.textContent = "Acceso Denegado: Esta cuenta no tiene privilegios de Máster.";
                loginError.style.display = 'block';
                return;
            }
            
            document.getElementById('userEmailDisplay').textContent = user.email;
            loginScreen.style.display = 'none';
            dashboardScreen.style.display = 'block';
            loadTenants();
        } else {
            loginScreen.style.display = 'flex';
            dashboardScreen.style.display = 'none';
            document.getElementById('tenantsTableBody').innerHTML = '';
        }
    });

    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const pwd = document.getElementById('loginPassword').value.trim();
        if(!email || !pwd) return;

        loginBtn.textContent = "Ingresando...";
        loginError.style.display = 'none';

        try {
            await window.auth.signInWithEmailAndPassword(email, pwd);
        } catch(e) {
            console.error(e);
            loginError.textContent = "Error: Credenciales inválidas o no tienes permisos.";
            loginError.style.display = 'block';
        } finally {
            loginBtn.textContent = "Ingresar al Panel";
        }
    });

    logoutBtn.addEventListener('click', () => {
        window.auth.signOut();
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.getElementById('tenantsTableBody').getElementsByTagName('tr');
            for (let i = 0; i < rows.length; i++) {
                const emailCell = rows[i].getElementsByTagName('td')[0];
                if (emailCell) {
                    const email = emailCell.textContent || emailCell.innerText;
                    if (email.toLowerCase().indexOf(term) > -1) {
                        rows[i].style.display = "";
                    } else {
                        rows[i].style.display = "none";
                    }
                }
            }
        });
    }
});

async function loadTenants() {
    const tbody = document.getElementById('tenantsTableBody');
    const loading = document.getElementById('loadingIndicator');
    
    try {
        const snapshot = await db.collection('tenants').orderBy('createdAt', 'desc').get();
        loading.style.display = 'none';
        
        document.getElementById('totalUsersCount').textContent = snapshot.docs.length;
        
        tbody.innerHTML = '';
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            
            const isSuspended = data.status === 'suspended';
            const statusBadge = isSuspended 
                ? `<span class="badge-suspended">Suspendido</span>` 
                : `<span class="badge-active">Activo</span>`;
                
            const actionBtn = isSuspended ? `<button class='btn btn-success btn-sm' style='width:100%; text-align:center;' onclick='toggleTenantStatus("${doc.id}", "active")'>Reactivar</button>` : `<button class='btn btn-danger btn-sm' style='width:100%; text-align:center;' onclick='toggleTenantStatus("${doc.id}", "suspended")'>Bloquear</button>`;
            const statsBtn = `<button class='btn btn-primary btn-sm' style='width:100%; text-align:center;' onclick='viewTenantStats("${doc.id}", "${data.email}")'>Ver Actividad</button>`;
            const deleteBtn = `<button class='btn btn-danger btn-sm' style='width:100%; text-align:center; background:#7f1d1d; border-color:#7f1d1d;' onclick='deleteTenant("${doc.id}", "${data.email}")'>Eliminar</button>`;

            let dateStr = 'N/A';
            if(data.createdAt && data.createdAt.toDate) {
                dateStr = data.createdAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            }
            let lastLoginStr = 'Sin registro';
            if(data.lastLogin && data.lastLogin.toDate) {
                lastLoginStr = data.lastLogin.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            }

            // Lógica de días de prueba (15 días base)
            let remainingDays = 0;
            const now = new Date();
            
            if (data.trialEndsAt && data.trialEndsAt.toDate) {
                const end = data.trialEndsAt.toDate();
                remainingDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
            } else if (data.createdAt && data.createdAt.toDate) {
                const start = data.createdAt.toDate();
                const end = new Date(start.getTime());
                end.setDate(end.getDate() + 15);
                remainingDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
            }

            let trialBadge = '';
            if (remainingDays > 0) {
                trialBadge = `<span style="color:#10b981; font-weight:bold; padding: 4px 8px; background: #d1fae5; border-radius: 4px;">${remainingDays} días</span>`;
            } else {
                trialBadge = `<span style="color:#ef4444; font-weight:bold; padding: 4px 8px; background: #fee2e2; border-radius: 4px;">Expirado (${remainingDays})</span>`;
            }

            tr.innerHTML = `
                <td style="font-weight: 600;">${data.email || 'Sin correo'}</td>
                <td style="color: #64748b;">${dateStr}</td>
                <td style="color: #0ea5e9; font-weight:500;">${lastLoginStr}</td>
                <td>${statusBadge}</td>
                <td>${trialBadge}</td>
                <td><div style="display: flex; flex-direction: column; gap: 5px; width: 110px;">${actionBtn} ${statsBtn} ${deleteBtn}</div></td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch(e) {
        console.error("Error loading tenants:", e);
        loading.textContent = "Error al cargar los negocios. Verifica que tengas permisos de Super Administrador.";
    }
}

window.viewTenantStats = async (tenantId, email) => {
    const modal = document.getElementById('statsModal');
    const content = document.getElementById('statsContent');
    modal.style.display = 'flex';
    content.innerHTML = '<div style="text-align:center; padding:20px;">Cargando actividad de <b>' + email + '</b>...</div>';

    try {
        let totalOrders = 0;
        let totalExpenses = 0;
        let configData = null;

        const configDoc = await db.collection('tenants').doc(tenantId).collection('minesof_settings').doc('global_config').get();
        if (configDoc.exists) configData = configDoc.data();

        const ordersSnap = await db.collection('tenants').doc(tenantId).collection('minesof_orders').get();
        totalOrders = ordersSnap.size;

        const expensesSnap = await db.collection('tenants').doc(tenantId).collection('minesof_expenses').get();
        totalExpenses = expensesSnap.size;

        const totalProducts = configData && configData.products ? configData.products.length : 0;
        const totalCategories = configData && configData.categories ? configData.categories.length : 0;
        
        let adminNote = '';
        let trialEndsAt = null;
        let createdAt = null;
        const tenantDoc = await db.collection('tenants').doc(tenantId).get();
        if (tenantDoc.exists) {
            const d = tenantDoc.data();
            adminNote = d.adminNote || '';
            trialEndsAt = d.trialEndsAt || null;
            createdAt = d.createdAt || null;
        }

        let currentRemainingDays = 0;
        const now = new Date();
        if (trialEndsAt && trialEndsAt.toDate) {
            currentRemainingDays = Math.ceil((trialEndsAt.toDate() - now) / (1000 * 60 * 60 * 24));
        } else if (createdAt && createdAt.toDate) {
            const start = createdAt.toDate();
            const end = new Date(start.getTime());
            end.setDate(end.getDate() + 15);
            currentRemainingDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        }

        content.innerHTML = `
            <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-bottom:15px;">
                <p style="margin:0 0 5px 0;"><strong>Correo:</strong> ` + email + `</p>
                <p style="margin:0;"><strong>Nombre Negocio:</strong> ` + (configData && configData.businessName ? configData.businessName : '<i>No configurado</i>') + `</p>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div style="border:1px solid #e2e8f0; padding:15px; border-radius:8px; text-align:center;">
                    <h2 style="margin:0; color:#2563eb;">` + totalOrders + `</h2>
                    <span style="font-size:0.85rem; color:#64748b;">Ventas/Pedidos</span>
                </div>
                <div style="border:1px solid #e2e8f0; padding:15px; border-radius:8px; text-align:center;">
                    <h2 style="margin:0; color:#10b981;">` + totalProducts + `</h2>
                    <span style="font-size:0.85rem; color:#64748b;">Productos Creados</span>
                </div>
                <div style="border:1px solid #e2e8f0; padding:15px; border-radius:8px; text-align:center;">
                    <h2 style="margin:0; color:#f59e0b;">` + totalCategories + `</h2>
                    <span style="font-size:0.85rem; color:#64748b;">Categorías</span>
                </div>
                <div style="border:1px solid #e2e8f0; padding:15px; border-radius:8px; text-align:center;">
                    <h2 style="margin:0; color:#ef4444;">` + totalExpenses + `</h2>
                    <span style="font-size:0.85rem; color:#64748b;">Egresos Registrados</span>
                </div>
            </div>
            
            <div style="margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                <label style="display:block; font-size:0.9rem; font-weight:600; margin-bottom:5px; color:#334155;">Gestionar Días de Prueba</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="number" id="addDaysInput_${tenantId}" placeholder="Ej: 5" style="padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; width: 80px;" min="1">
                    <button onclick="addTrialDays('${tenantId}')" class="btn btn-success" style="padding: 8px 15px;">Agregar Días</button>
                    <span style="font-size: 0.85rem; color: #64748b;">(Actualmente: <b>${currentRemainingDays}</b> días)</span>
                </div>
                <div id="daysSaveMsg_${tenantId}" style="display:none; color:#10b981; font-size:0.85rem; margin-top:5px; font-weight:500;">Días agregados correctamente.</div>
            </div>

            <div style="margin-top: 15px;">
                <label style="display:block; font-size:0.9rem; font-weight:600; margin-bottom:5px; color:#334155;">Notas del Administrador</label>
                <textarea id="adminNoteText_${tenantId}" rows="3" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-family:inherit; resize:vertical; box-sizing:border-box;" placeholder="Escribe aquí notas sobre este negocio...">${adminNote}</textarea>
                <button onclick="saveAdminNote('${tenantId}')" class="btn btn-primary" style="margin-top:8px; width:100%; background:#0f172a; color:white;">Guardar Nota</button>
                <div id="noteSaveMsg_${tenantId}" style="display:none; color:#10b981; font-size:0.85rem; margin-top:5px; text-align:center; font-weight: 500;">Nota guardada exitosamente.</div>
            </div>
        `;
    } catch(e) {
        console.error(e);
        content.innerHTML = '<p style="color:red; text-align:center;">Error al cargar datos.<br><br>Necesitas actualizar las <b>Reglas de Seguridad de Firebase</b> para permitir al Super Administrador leer los datos de los inquilinos.</p>';
    }
};

window.toggleTenantStatus = async (tenantId, newStatus) => {
    if(!confirm(`¿Estás seguro que deseas ${newStatus === 'active' ? 'REACTIVAR' : 'BLOQUEAR'} este negocio?`)) return;
    
    try {
        await db.collection('tenants').doc(tenantId).update({
            status: newStatus
        });
        loadTenants(); // reload list
    } catch(e) {
        alert("Error al actualizar el estado: " + e.message);
    }
};

window.saveAdminNote = async (tenantId) => {
    const textarea = document.getElementById(`adminNoteText_${tenantId}`);
    const msgDiv = document.getElementById(`noteSaveMsg_${tenantId}`);
    if (!textarea) return;
    
    const noteContent = textarea.value.trim();
    
    try {
        await db.collection('tenants').doc(tenantId).set({
            adminNote: noteContent
        }, { merge: true });
        
        if (msgDiv) {
            msgDiv.style.display = 'block';
            setTimeout(() => {
                msgDiv.style.display = 'none';
            }, 3000);
        }
    } catch(e) {
        console.error("Error al guardar la nota:", e);
        alert("Error al guardar la nota: " + e.message);
    }
};

window.addTrialDays = async (tenantId) => {
    const input = document.getElementById(`addDaysInput_${tenantId}`);
    const msgDiv = document.getElementById(`daysSaveMsg_${tenantId}`);
    if (!input || !input.value) return;
    
    const extraDays = parseInt(input.value);
    if (isNaN(extraDays) || extraDays <= 0) return;
    
    try {
        const tenantRef = db.collection('tenants').doc(tenantId);
        const docSnap = await tenantRef.get();
        if (!docSnap.exists) return;
        
        const data = docSnap.data();
        let currentEnd = new Date(); 
        
        if (data.trialEndsAt && data.trialEndsAt.toDate) {
            const endsAt = data.trialEndsAt.toDate();
            if (endsAt > new Date()) {
                currentEnd = endsAt;
            }
        } else if (data.createdAt && data.createdAt.toDate) {
            const start = data.createdAt.toDate();
            const end = new Date(start.getTime());
            end.setDate(end.getDate() + 15);
            if (end > new Date()) {
                currentEnd = end;
            }
        }
        
        currentEnd.setDate(currentEnd.getDate() + extraDays);
        
        await tenantRef.set({
            trialEndsAt: firebase.firestore.Timestamp.fromDate(currentEnd)
        }, { merge: true });
        
        if (msgDiv) {
            msgDiv.style.display = 'block';
            setTimeout(() => {
                msgDiv.style.display = 'none';
                viewTenantStats(tenantId, data.email); 
                loadTenants(); 
            }, 1500);
        }
        
    } catch(e) {
        console.error("Error al agregar días:", e);
        alert("Error al agregar días: " + e.message);
    }
};

window.deleteTenant = async (tenantId, email) => {
    if(!confirm(ATENCIÓN: ¿Estás seguro que deseas ELIMINAR por completo el negocio de ' + email + '? Esta acción NO se puede deshacer y borrará todos los registros del negocio en la base de datos.)) return;
    
    try {
        await db.collection('tenants').doc(tenantId).delete();
        loadTenants();
    } catch(e) {
        alert("Error al eliminar: " + e.message);
    }
};