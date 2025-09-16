// Demo data for testing the lunch orders system
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

// Demo clients based on the codes shown in the user's image
export const demoClients = {
  "C710796": {
    id: "C710796",
    code: "C710796",
    fullName: "Rodrigo Eduardo Mercado Rivera",
    grade: "5°",
    classroom: "A",
    level: "primaria" as const,
    active: true,
    accountEnabled: true,
    phone1: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  "C710920": {
    id: "C710920", 
    code: "C710920",
    fullName: "Adrian Saenz Moron",
    grade: "3°",
    classroom: "B", 
    level: "primaria" as const,
    active: true,
    accountEnabled: true,
    phone1: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  "C711286": {
    id: "C711286",
    code: "C711286", 
    fullName: "Alessandro Schroth Vásquez",
    grade: "2°",
    classroom: "A",
    level: "primaria" as const,
    active: true,
    accountEnabled: true,
    phone1: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  "C711407": {
    id: "C711407",
    code: "C711407",
    fullName: "Alice LEDGARD BARDELLI", 
    grade: "1°",
    classroom: "C",
    level: "primaria" as const,
    active: true,
    accountEnabled: true,
    phone1: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  "C711649": {
    id: "C711649",
    code: "C711649",
    fullName: "Milagros Fatima Jacinto Zevallos",
    grade: "4°", 
    classroom: "B",
    level: "primaria" as const,
    active: true,
    accountEnabled: true,
    phone1: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  "C711890": {
    id: "C711890",
    code: "C711890",
    fullName: "Andrea Carolina Siancas Nehmad",
    grade: "6°",
    classroom: "A",
    level: "primaria" as const,
    active: true,
    accountEnabled: true, 
    phone1: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
};

// Demo lunch menu items
export const demoLunchMenu = {
  "menu001": {
    id: "menu001",
    name: "Arroz con Pollo",
    description: "Arroz amarillo con pollo deshilachado, papa amarilla y ensalada fresca",
    price: 8.50,
    image: "",
    isActive: true,
    category: "Platos Principales",
    dailyLimit: 100
  },
  "menu002": {
    id: "menu002", 
    name: "Tallarines Rojos",
    description: "Tallarines en salsa roja con carne molida y queso parmesano",
    price: 7.00,
    image: "",
    isActive: true,
    category: "Platos Principales", 
    dailyLimit: 80
  },
  "menu003": {
    id: "menu003",
    name: "Pescado a la Plancha",
    description: "Filete de pescado a la plancha con arroz blanco y ensalada verde",
    price: 9.00,
    image: "",
    isActive: true,
    category: "Platos Principales",
    dailyLimit: 60
  },
  "menu004": {
    id: "menu004",
    name: "Menestra con Arroz",
    description: "Menestra de frejoles con arroz, bistec apanado y ensalada criolla",
    price: 8.00,
    image: "",
    isActive: true,
    category: "Platos Principales",
    dailyLimit: 70
  },
  "menu005": {
    id: "menu005",
    name: "Jugo Natural",
    description: "Jugo natural de frutas de temporada (naranja, maracuyá, papaya)",
    price: 3.00,
    image: "",
    isActive: true,
    category: "Bebidas",
    dailyLimit: 150
  }
};

// Demo lunch settings
export const demoLunchSettings = {
  cutoffTime: "11:00",
  allowEditsMinutes: 30,
  showPrices: true,
  deliveryTracking: true
};

// Function to initialize demo data
export async function initializeDemoLunchData() {
  try {
    console.log("Initializing demo lunch data...");
    
    // Check if clients already exist
    const existingClients = await RTDBHelper.getData(RTDB_PATHS.clients);
    if (!existingClients || Object.keys(existingClients).length === 0) {
      console.log("Adding demo clients...");
      await RTDBHelper.setData(RTDB_PATHS.clients, demoClients);
    }
    
    // Check if lunch menu exists
    const existingMenu = await RTDBHelper.getData(RTDB_PATHS.lunch_menu);
    if (!existingMenu || Object.keys(existingMenu).length === 0) {
      console.log("Adding demo lunch menu...");
      await RTDBHelper.setData(RTDB_PATHS.lunch_menu, demoLunchMenu);
    }
    
    // Check if lunch settings exist
    const existingSettings = await RTDBHelper.getData(RTDB_PATHS.lunch_settings);
    if (!existingSettings) {
      console.log("Adding demo lunch settings...");
      await RTDBHelper.setData(RTDB_PATHS.lunch_settings, demoLunchSettings);
    }
    
    console.log("Demo lunch data initialized successfully!");
    return true;
  } catch (error) {
    console.error("Error initializing demo lunch data:", error);
    return false;
  }
}