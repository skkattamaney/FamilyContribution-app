// Enhanced Family LEDGER - Frontend JavaScript with Authentication

// Configuration - Replace with your Google Apps Script Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbzDeoM41Tf6T7EsJxcLHfqtyLtvbMoqT7SAOMvzrjpdYBGY1lU3ZuORN38rcR8AmhP6/exec';

// Application state
let currentUser = null;
let sessionToken = null;
let lastTransactionId = null;

// Category mapping for validation
const categoryMapping = {
    'Monthly Dues': ['Regular Monthly Dues'],
    'Special Contributions': ['Toilet Project', 'Gadzekpo', 'Other Funds', 'Special Individual Contribution'],
    'Expenditure': ['Expenditure: Toilet Project', 'Expenditure: Gadzekpo', 'Expenditure: Monthly Dues', 'Expenditure: Special Individual Contribution']
};

// DOM Elements
const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
const editModal = new bootstrap.Modal(document.getElementById('editModal'));
const mainContainer = document.getElementById('mainContainer');
const form = document.getElementById('ledgerForm');
const loginForm = document.getElementById('loginForm');
const editForm = document.getElementById('editForm');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkSession();
    setupEventListeners();
    initializeForm();
});

/**
 * Check if user has valid session
 */
function checkSession() {
    sessionToken = localStorage.getItem('ledger_session_token');
    const userData = localStorage.getItem('ledger_user_data');
    
    if (sessionToken && userData) {
        currentUser = JSON.parse(userData);
        showMainApp();
    } else {
        showLoginModal();
    }
}

/**
 * Show login modal
 */
function showLoginModal() {
    mainContainer.style.display = 'none';
    loginModal.show();
}

/**
 * Show main application
 */
function showMainApp() {
    document.getElementById('userName').textContent = currentUser.name;
    mainContainer.style.display = 'block';
    try {
        loginModal.hide();
    } catch (e) {
        // Modal might not be initialized
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);
    
    // Main form
    form.addEventListener('submit', handleFormSubmit);
    
    // Edit functionality
    document.getElementById('editLastBtn').addEventListener('click', openEditModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveEditTransaction);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Transaction type change for category filtering
    document.getElementById('transactionType').addEventListener('change', updateCategoryOptions);
    document.getElementById('editTransactionType').addEventListener('change', function() {
        updateCategoryOptions.call(this, 'edit');
    });
    
    // Month synchronization
    document.getElementById('month').addEventListener('change', syncMonthToNumber);
    document.getElementById('monthNum').addEventListener('change', syncNumberToMonth);
    document.getElementById('editMonth').addEventListener('change', function() {
        syncMonthToNumber.call(this, 'edit');
    });
    document.getElementById('editMonthNum').addEventListener('change', function() {
        syncNumberToMonth.call(this, 'edit');
    });
    
    // Date field updates
    document.getElementById('date').addEventListener('change', updateDateFields);
    document.getElementById('editDate').addEventListener('change', function() {
        updateDateFields.call(this, 'edit');
    });
}

/**
 * Handle user login
 */
async function handleLogin(event) {
    event.preventDefault();
    
    setLoginLoadingState(true);
    clearLoginAlerts();
    
    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'login',
                email: email,
                password: password
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser = result.user;
            sessionToken = result.sessionToken;
            
            // Store session data
            localStorage.setItem('ledger_session_token', sessionToken);
            localStorage.setItem('ledger_user_data', JSON.stringify(currentUser));
            
            showMainApp();
            loginForm.reset();
        } else {
            showLoginAlert(result.message, 'danger');
        }
        
    } catch (error) {
        showLoginAlert('Network error: ' + error.message, 'danger');
    } finally {
        setLoginLoadingState(false);
    }
}

/**
 * Handle user logout
 */
function handleLogout() {
    currentUser = null;
    sessionToken = null;
    lastTransactionId = null;
    
    localStorage.removeItem('ledger_session_token');
    localStorage.removeItem('ledger_user_data');
    
    form.reset();
    initializeForm();
    document.getElementById('editLastBtn').classList.add('d-none');
    
    showLoginModal();
}

/**
 * Initialize form with defaults
 */
function initializeForm() {
    // Populate years
    populateYears('year');
    populateYears('editYear');
    
    // Set current date
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    document.getElementById('date').value = dateString;
    document.getElementById('year').value = today.getFullYear();
    
    // Initialize category options
    updateCategoryOptions.call(document.getElementById('transactionType'));
}

/**
 * Populate year dropdowns
 */
function populateYears(elementId) {
    const yearSelect = document.getElementById(elementId);
    // Clear existing options except the first one
    while (yearSelect.children.length > 1) {
        yearSelect.removeChild(yearSelect.lastChild);
    }
    
    for (let year = 2022; year <= 2040; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

/**
 * Update category options based on transaction type
 */
function updateCategoryOptions(prefix = '') {
    const transactionType = this.value;
    const categorySelect = document.getElementById(prefix ? `${prefix}Category` : 'category');
    
    // Clear existing options
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    
    if (transactionType && categoryMapping[transactionType]) {
        categoryMapping[transactionType].forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
        
        // Add visual feedback
        categorySelect.classList.add('is-valid');
        categorySelect.classList.remove('is-invalid');
    } else if (transactionType) {
        categorySelect.classList.add('is-invalid');
        categorySelect.classList.remove('is-valid');
    } else {
        categorySelect.classList.remove('is-valid', 'is-invalid');
    }
}

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    setLoadingState(true);
    clearAlerts();
    
    try {
        const formData = collectFormData();
        
        // Client-side validation
        const validation = validateFormData(formData);
        if (!validation.isValid) {
            showAlert('Please fix the following errors:\n• ' + validation.errors.join('\n• '), 'danger');
            highlightInvalidFields(validation.invalidFields);
            setLoadingState(false);
            return;
        }
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'submit',
                sessionToken: sessionToken,
                formData: formData
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            lastTransactionId = result.transactionId;
            showAlert(`✅ ${result.message}`, 'success');
            form.reset();
            initializeForm();
            
            // Show edit button
            const editBtn = document.getElementById('editLastBtn');
            editBtn.classList.remove('d-none');
            editBtn.classList.add('btn-appear');
            
        } else {
            if (result.message.includes('Session expired')) {
                handleLogout();
                return;
            }
            showAlert(`❌ ${result.message}`, 'danger');
        }
        
    } catch (error) {
        showAlert(`❌ Network error: ${error.message}`, 'danger');
    } finally {
        setLoadingState(false);
    }
}

/**
 * Open edit modal for last transaction
 */
async function openEditModal() {
    if (!lastTransactionId) {
        showAlert('No recent transaction to edit', 'warning');
        return;
    }
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'getTransaction',
                sessionToken: sessionToken,
                transactionId: lastTransactionId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            populateEditForm(result.transaction);
            editModal.show();
        } else {
            showAlert(`Error loading transaction: ${result.message}`, 'danger');
        }
        
    } catch (error) {
        showAlert(`Network error: ${error.message}`, 'danger');
    }
}

/**
 * Populate edit form with transaction data
 */
function populateEditForm(transaction) {
    // Convert ddmmyyyy date back to yyyy-mm-dd format
    const dateStr = transaction.date.toString();
    if (dateStr.length === 8) {
        const day = dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const year = dateStr.substring(4, 8);
        document.getElementById('editDate').value = `${year}-${month}-${day}`;
    }
    
    document.getElementById('editTransactionType').value = transaction.transactionType;
    document.getElementById('editYear').value = transaction.year;
    document.getElementById('editMonth').value = transaction.month;
    document.getElementById('editMonthNum').value = transaction.monthNum;
    document.getElementById('editFamilyMember').value = transaction.familyMember;
    document.getElementById('editAmount').value = transaction.amount;
    document.getElementById('editDescription').value = transaction.description;
    
    // Update category options and set value
    updateCategoryOptions.call(document.getElementById('editTransactionType'), 'edit');
    setTimeout(() => {
        document.getElementById('editCategory').value = transaction.category;
    }, 100);
}

/**
 * Save edited transaction
 */
async function saveEditTransaction() {
    setSaveLoadingState(true);
    clearEditAlerts();
    
    try {
        const formData = collectEditFormData();
        
        const validation = validateFormData(formData);
        if (!validation.isValid) {
            showEditAlert('Please fix the following errors:\n• ' + validation.errors.join('\n• '), 'danger');
            setSaveLoadingState(false);
            return;
        }
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateTransaction',
                sessionToken: sessionToken,
                transactionId: lastTransactionId,
                formData: formData
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showEditAlert(`✅ ${result.message}`, 'success');
            setTimeout(() => {
                editModal.hide();
                showAlert('Transaction updated successfully!', 'success');
            }, 1500);
        } else {
            showEditAlert(`❌ ${result.message}`, 'danger');
        }
        
    } catch (error) {
        showEditAlert(`❌ Network error: ${error.message}`, 'danger');
    } finally {
        setSaveLoadingState(false);
    }
}

/**
 * Collect form data
 */
function collectFormData() {
    return {
        transactionType: document.getElementById('transactionType').value,
        date: document.getElementById('date').value,
        year: document.getElementById('year').value,
        month: document.getElementById('month').value,
        monthNum: document.getElementById('monthNum').value,
        familyMember: document.getElementById('familyMember').value,
        amount: document.getElementById('amount').value,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value
    };
}

/**
 * Collect edit form data
 */
function collectEditFormData() {
    return {
        transactionType: document.getElementById('editTransactionType').value,
        date: document.getElementById('editDate').value,
        year: document.getElementById('editYear').value,
        month: document.getElementById('editMonth').value,
        monthNum: document.getElementById('editMonthNum').value,
        familyMember: document.getElementById('editFamilyMember').value,
        amount: document.getElementById('editAmount').value,
        category: document.getElementById('editCategory').value,
        description: document.getElementById('editDescription').value
    };
}

/**
 * Enhanced validation with transaction type matching
 */
function validateFormData(data) {
    const errors = [];
    const invalidFields = [];
    
    // Basic validation
    if (!data.transactionType) {
        errors.push('Transaction Type is required');
        invalidFields.push('transactionType');
    }
    if (!data.date) {
        errors.push('Date is required');
        invalidFields.push('date');
    }
    if (!data.year) {
        errors.push('Year is required');
        invalidFields.push('year');
    }
    if (!data.month) {
        errors.push('Month is required');
        invalidFields.push('month');
    }
    if (!data.monthNum) {
        errors.push('Month Number is required');
        invalidFields.push('monthNum');
    }
    if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
        errors.push('Valid amount greater than 0 is required');
        invalidFields.push('amount');
    }
    if (!data.category) {
        errors.push('Category is required');
        invalidFields.push('category');
    }
    
    // Transaction type and category matching validation
    if (data.transactionType && data.category) {
        const allowedCategories = categoryMapping[data.transactionType];
        if (allowedCategories && !allowedCategories.includes(data.category)) {
            errors.push(`"${data.category}" is not valid for "${data.transactionType}". Valid options: ${allowedCategories.join(', ')}`);
            invalidFields.push('category');
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        invalidFields: invalidFields
    };
}

/**
 * Highlight invalid form fields
 */
function highlightInvalidFields(invalidFields) {
    // Clear previous validation states
    document.querySelectorAll('.form-control, .form-select').forEach(el => {
        el.classList.remove('is-invalid', 'is-valid');
    });
    
    // Highlight invalid fields
    invalidFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (field) {
            field.classList.add('is-invalid');
        }
    });
}

/**
 * Month/MonthNum synchronization
 */
function syncMonthToNumber(prefix = '') {
    const monthNames = {
        'January': '1', 'February': '2', 'March': '3', 'April': '4',
        'May': '5', 'June': '6', 'July': '7', 'August': '8',
        'September': '9', 'October': '10', 'November': '11', 'December': '12'
    };
    
    const selectedMonth = this.value;
    if (selectedMonth && monthNames[selectedMonth]) {
        const monthNumId = prefix ? `${prefix}MonthNum` : 'monthNum';
        document.getElementById(monthNumId).value = monthNames[selectedMonth];
    }
}

function syncNumberToMonth(prefix = '') {
    const monthNumbers = {
        '1': 'January', '2': 'February', '3': 'March', '4': 'April',
        '5': 'May', '6': 'June', '7': 'July', '8': 'August',
        '9': 'September', '10': 'October', '11': 'November', '12': 'December'
    };
    
    const selectedMonthNum = this.value;
    if (selectedMonthNum && monthNumbers[selectedMonthNum]) {
        const monthId = prefix ? `${prefix}Month` : 'month';
        document.getElementById(monthId).value = monthNumbers[selectedMonthNum];
    }
}

/**
 * Update date fields when date input changes
 */
function updateDateFields(prefix = '') {
    const selectedDate = new Date(this.value);
    
    const yearId = prefix ? `${prefix}Year` : 'year';
    const monthId = prefix ? `${prefix}Month` : 'month';
    const monthNumId = prefix ? `${prefix}MonthNum` : 'monthNum';
    
    document.getElementById(yearId).value = selectedDate.getFullYear();
    
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    document.getElementById(monthId).value = monthNames[selectedDate.getMonth()];
    document.getElementById(monthNumId).value = selectedDate.getMonth() + 1;
}

/**
 * UI Helper Functions
 */
function showAlert(message, type) {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message.replace(/\n/g, '<br>')}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    document.getElementById('alertContainer').innerHTML = alertHtml;
    document.getElementById('alertContainer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearAlerts() {
    document.getElementById('alertContainer').innerHTML = '';
}

function showLoginAlert(message, type) {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    document.getElementById('loginAlert').innerHTML = alertHtml;
}

function clearLoginAlerts() {
    document.getElementById('loginAlert').innerHTML = '';
}

function showEditAlert(message, type) {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message.replace(/\n/g, '<br>')}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    document.getElementById('editAlert').innerHTML = alertHtml;
}

function clearEditAlerts() {
    document.getElementById('editAlert').innerHTML = '';
}

function setLoadingState(isLoading) {
    const submitBtn = document.getElementById('submitBtn');
    const submitText = submitBtn.querySelector('.submit-text');
    const loadingText = submitBtn.querySelector('.loading');
    
    if (isLoading) {
        submitText.classList.add('d-none');
        loadingText.classList.remove('d-none');
        submitBtn.disabled = true;
    } else {
        submitText.classList.remove('d-none');
        loadingText.classList.add('d-none');
        submitBtn.disabled = false;
    }
}

function setLoginLoadingState(isLoading) {
    const loginBtn = document.getElementById('loginBtn');
    const loginText = loginBtn.querySelector('.login-text');
    const loadingText = loginBtn.querySelector('.login-loading');
    
    if (isLoading) {
        loginText.classList.add('d-none');
        loadingText.classList.remove('d-none');
        loginBtn.disabled = true;
    } else {
        loginText.classList.remove('d-none');
        loadingText.classList.add('d-none');
        loginBtn.disabled = false;
    }
}

function setSaveLoadingState(isLoading) {
    const saveBtn = document.getElementById('saveEditBtn');
    const saveText = saveBtn.querySelector('.save-text');
    const loadingText = saveBtn.querySelector('.save-loading');
    
    if (isLoading) {
        saveText.classList.add('d-none');
        loadingText.classList.remove('d-none');
        saveBtn.disabled = true;
    } else {
        saveText.classList.remove('d-none');
        loadingText.classList.add('d-none');
        saveBtn.disabled = false;
    }
}
