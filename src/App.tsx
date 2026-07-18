/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Instagram,
  Smartphone,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  Sparkles,
  UtensilsCrossed,
  Phone,
  X,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Edit3,
  Save,
  Eye,
  LogOut,
  QrCode,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Undo2,
  CheckSquare,
  Square,
  Sparkle,
  Upload,
  Tag,
} from "lucide-react";

import {
  RestaurantInfo,
  MenuCategory,
  MenuItem,
  GalleryItem,
  FullMenuDataset,
  DailyPromotion,
  restaurantInfo as staticRestaurantInfo,
  menuCategories as staticMenuCategories,
  beverageSubcategories as staticBeverageSubcategories,
  menuItems as staticMenuItems,
  galleryItems as staticGalleryItems,
  promotions as staticPromotions,
  adminPassword as staticAdminPassword
} from "./data/menuData";



import DomEduardoLogo from "./components/DomEduardoLogo";
import MenuItemCard from "./components/MenuItemCard";
import ZoomModal from "./components/ZoomModal";
import { QRCodeCanvas } from "qrcode.react";

import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const renderWithBold = (text: string) => {
  if (!text) return null;
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} className="font-semibold text-white">{part}</strong>;
    }
    return part;
  });
};

export default function App() {
  // Database Dataset State
  const [menuData, setMenuData] = useState<FullMenuDataset>({
    restaurantInfo: staticRestaurantInfo,
    menuCategories: staticMenuCategories,
    beverageSubcategories: staticBeverageSubcategories,
    menuItems: staticMenuItems,
    galleryItems: staticGalleryItems,
    promotions: staticPromotions,
    adminPassword: staticAdminPassword
  });

  // Client App Navigation States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZoomItem, setSelectedZoomItem] = useState<MenuItem | null>(null);

  // Dynamically resolve the active zoomed item from the latest state to support real-time sync in lightboxes
  const activeZoomedItem = React.useMemo(() => {
    if (!selectedZoomItem) return null;
    return menuData.menuItems.find((item) => item.id === selectedZoomItem.id) || selectedZoomItem;
  }, [selectedZoomItem, menuData.menuItems]);

  const [activeCategory, setActiveCategory] = useState("destaques");
  const [openBeverageSubs, setOpenBeverageSubs] = useState<Record<string, boolean>>({
    refrigerantes: true,
    "sucos-naturais": false,
    aguas: false,
    cervejas: false,
    drinks: false,
    vinhos: false,
    destilados: false,
    cafes: false,
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isPratosIndividuaisOpen, setIsPratosIndividuaisOpen] = useState(false);
  const menuSectionsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const editingStateRef = useRef({
    isAdminMode: false,
    isDishModalOpen: false,
    isPromoModalOpen: false,
    isCategoryModalOpen: false,
    isGalleryModalOpen: false,
    adminTab: "geral" as const,
  });

  const [lastUpdated, setLastUpdated] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });


  // Admin States
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [adminTab, setAdminTab] = useState<"geral" | "pratos" | "categorias" | "galeria" | "config" | "promocoes">("geral");
  const [activeAdminPassword, setActiveAdminPassword] = useState(staticAdminPassword);

  // Password Lockout States
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    return Number(localStorage.getItem("admin_failed_attempts") || "0");
  });
  const [lockoutExpiry, setLockoutExpiry] = useState<number>(() => {
    return Number(localStorage.getItem("admin_lockout_expiry") || "0");
  });
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    let intervalId: any;
    if (lockoutExpiry > currentTime) {
      intervalId = setInterval(() => {
        const now = Date.now();
        setCurrentTime(now);
        if (now >= lockoutExpiry) {
          setFailedAttempts(0);
          localStorage.removeItem("admin_failed_attempts");
          localStorage.removeItem("admin_lockout_expiry");
          setLoginError("");
        }
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [lockoutExpiry, currentTime]);

  // QR URL Customization States
  const [qrUrlType, setQrUrlType] = useState<"public" | "custom">(() => {
    const saved = localStorage.getItem("qr_url_type");
    if (saved && (saved === "public" || saved === "custom")) return saved as "public" | "custom";
    return "public";
  });
  const [customQrUrl, setCustomQrUrl] = useState(() => {
    return localStorage.getItem("custom_qr_url") || "";
  });

  useEffect(() => {
    localStorage.setItem("qr_url_type", qrUrlType);
  }, [qrUrlType]);

  useEffect(() => {
    localStorage.setItem("custom_qr_url", customQrUrl);
  }, [customQrUrl]);
  
  // Saving Status
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Split beverages category into flat subcategories dynamically for customer view
  const renderedCategories = React.useMemo(() => {
    const hasUnhighlightedBaguetes = menuData.menuItems.some(
      (item) => item.categoryId === "baguetes" && !item.isHighlight
    );
    if (hasUnhighlightedBaguetes) {
      return menuData.menuCategories;
    }
    return menuData.menuCategories.filter((cat) => cat.id !== "baguetes");
  }, [menuData]);

  // Form Editing Modals / Temporary States
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [dishForm, setDishForm] = useState<Partial<MenuItem>>({});
  
  // Category Form Temporary States
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<Partial<MenuCategory>>({});
  const [categoryType, setCategoryType] = useState<"main" | "beverage">("main");

  // Gallery Form Temporary States
  const [editingGallery, setEditingGallery] = useState<GalleryItem | null>(null);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [galleryForm, setGalleryForm] = useState<Partial<GalleryItem>>({});

  // Promotion Form Temporary States
  const [editingPromo, setEditingPromo] = useState<DailyPromotion | null>(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoForm, setPromoForm] = useState<Partial<DailyPromotion>>({});

  // Preset Unsplash food/beverage stock photos for easy image picking
  const imagePresets = [
    { name: "Prato Peixe/Frutos do Mar", url: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80" },
    { name: "Camarão Frito", url: "https://images.unsplash.com/photo-1508736793122-f516e1ba69cf?auto=format&fit=crop&w=600&q=80" },
    { name: "Carne na Chapa", url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80" },
    { name: "Baguete/Sanduíche", url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80" },
    { name: "Parmegiana/Massa", url: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=600&q=80" },
    { name: "Batata Frita", url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80" },
    { name: "Suco Natural", url: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80" },
    { name: "Cerveja Gelada", url: "https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80" },
    { name: "Cocktail/Drink", url: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80" },
    { name: "Vinho Fino", url: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=600&q=80" },
    { name: "Expresso", url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80" },
    { name: "Brownie Doce", url: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80" }
  ];

  // Helper for reading uploaded files as Base64 data URLs with auto-resizing & compression
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (base64: string) => void,
    maxSize = 480,
    quality = 0.82
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setSaveToast({ type: "error", message: "A foto é muito grande! Escolha uma imagem de até 20MB." });
      setTimeout(() => setSaveToast(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl !== "string") return;

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const MAX_WIDTH = maxSize;
        const MAX_HEIGHT = maxSize;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        // Stepped downscaling for professional crispness and zero aliasing
        let currentCanvas = document.createElement("canvas");
        let currentCtx = currentCanvas.getContext("2d");
        currentCanvas.width = img.width;
        currentCanvas.height = img.height;
        if (currentCtx) {
          currentCtx.drawImage(img, 0, 0);
        }

        let curWidth = img.width;
        let curHeight = img.height;

        // Reduce dimensions incrementally to maintain fine pixel detail
        while (curWidth > width * 1.5 || curHeight > height * 1.5) {
          const nextWidth = Math.round(curWidth / 2);
          const nextHeight = Math.round(curHeight / 2);

          if (nextWidth < width || nextHeight < height) break;

          const nextCanvas = document.createElement("canvas");
          nextCanvas.width = nextWidth;
          nextCanvas.height = nextHeight;
          const nextCtx = nextCanvas.getContext("2d");
          if (nextCtx) {
            nextCtx.imageSmoothingEnabled = true;
            nextCtx.imageSmoothingQuality = "high";
            nextCtx.drawImage(currentCanvas, 0, 0, curWidth, curHeight, 0, 0, nextWidth, nextHeight);
          }
          currentCanvas = nextCanvas;
          curWidth = nextWidth;
          curHeight = nextHeight;
        }

        // Final scale
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(currentCanvas, 0, 0, curWidth, curHeight, 0, 0, width, height);

          // Use image/webp for ultimate quality at very small file sizes, fallback to image/jpeg if unsupported
          let compressed = canvas.toDataURL("image/webp", quality);
          if (!compressed.startsWith("data:image/webp")) {
            compressed = canvas.toDataURL("image/jpeg", quality);
          }
          onSuccess(compressed);
        } else {
          onSuccess(dataUrl);
        }
      };
      img.onerror = () => {
        onSuccess(dataUrl);
      };
    };
    reader.readAsDataURL(file);
  };

  // Fetch live database on mount
  useEffect(() => {
    fetchMenuData();

    // Check if admin is requested in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true" || params.get("acesso") === "proprietario" || params.get("painel") === "gerente") {
      setIsAdminMode(true);
      // Autoauthenticate if previously unlocked in sessionStorage
      if (sessionStorage.getItem("admin_authenticated") === "true") {
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Update editingStateRef synchronously on every render to ensure callbacks always have the freshest values without subscription thrashing
  editingStateRef.current = {
    isAdminMode,
    isDishModalOpen,
    isPromoModalOpen,
    isCategoryModalOpen,
    isGalleryModalOpen,
    adminTab,
  };

  // Listen to Firebase changes in real-time
  useEffect(() => {
    const docRef = doc(db, "menu", "main");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        // Don't overwrite if user is currently editing
        if (isUserCurrentlyEditing()) {
          console.log("[Firebase] Live update deferred (admin is editing).");
          return;
        }

        const liveData = docSnap.data() as FullMenuDataset;
        console.log("[Firebase] Live update applied!");
        setMenuData(liveData);
        localStorage.setItem("local_menu_data", JSON.stringify(liveData));
        if (liveData.adminPassword) {
          setActiveAdminPassword(liveData.adminPassword);
        }
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }
    }, (error) => {
      console.warn("[Firebase] Realtime listener error:", error);
    });

    return () => unsubscribe();
  }, []);

  // Reload from localStorage when page becomes visible
  useEffect(() => {
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === "visible") {
        const cached = localStorage.getItem("local_menu_data");
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            setMenuData(cachedData);
            if (cachedData.adminPassword) {
              setActiveAdminPassword(cachedData.adminPassword);
            }
          } catch (e) {
            console.warn("[Cache] Error parsing local storage cache:", e);
          }
        }
      }
    };

    window.addEventListener("focus", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", handleFocusOrVisibility);

    return () => {
      window.removeEventListener("focus", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
    };
  }, []);

  // Check if the admin is currently typing or editing a form to prevent background sync from overwriting unsaved work
  const isUserCurrentlyEditing = () => {
    const { isAdminMode, isDishModalOpen, isPromoModalOpen, isCategoryModalOpen, isGalleryModalOpen, adminTab } = editingStateRef.current;
    if (!isAdminMode) return false;
    
    // 1. If any modal is open
    if (isDishModalOpen || isPromoModalOpen || isCategoryModalOpen || isGalleryModalOpen) {
      return true;
    }
    
    // 2. If the active admin tab has inline text inputs (General Info or Settings)
    if (adminTab === "geral" || adminTab === "config") {
      return true;
    }
    
    // 3. If any input/textarea is currently focused in the document
    const activeEl = document.activeElement;
    if (activeEl && (
      activeEl.tagName === "INPUT" || 
      activeEl.tagName === "TEXTAREA" || 
      activeEl.getAttribute("contenteditable") === "true"
    )) {
      return true;
    }
    
    return false;
  };



  const fetchMenuData = async () => {
    // 1. Load from localStorage first (instant)
    const cached = localStorage.getItem("local_menu_data");
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        setMenuData(cachedData);
        if (cachedData.adminPassword) {
          setActiveAdminPassword(cachedData.adminPassword);
        }
      } catch (e) {
        console.warn("[Cache] Error parsing local storage cache:", e);
      }
    }

    // 2. Fetch from Firebase Firestore (always, to get latest data)
    try {
      const docRef = doc(db, "menu", "main");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as FullMenuDataset;
        setMenuData(data);
        localStorage.setItem("local_menu_data", JSON.stringify(data));
        if (data.adminPassword) {
          setActiveAdminPassword(data.adminPassword);
        }
        console.log("[Firebase] Menu loaded from Firestore.");
      }
    } catch (e) {
      console.warn("[Firebase] Could not fetch from Firestore, using cached/default data:", e);
    }

    const now = new Date();
    setLastUpdated(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  };

  // Scroll logic for Customer View
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 600) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }

      if (searchQuery.trim() === "" && !isAdminMode) {
        let currentActive = "destaques";

        for (const cat of renderedCategories) {
          const el = menuSectionsRef.current[cat.id];
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= 200 && rect.bottom > 200) {
              currentActive = cat.id;
              break;
            }
          }
        }
        setActiveCategory(currentActive);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [searchQuery, isAdminMode, renderedCategories]);

  // Handle Login Authentication
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const now = Date.now();
    
    // Bypass lockout if the password typed is the correct one ("8111" or stored password)
    if (loginPassword === "8111" || loginPassword === menuData.adminPassword) {
      setIsAuthenticated(true);
      setActiveAdminPassword("8111");
      setLoginError("");
      setFailedAttempts(0);
      setLockoutExpiry(0);
      localStorage.removeItem("admin_failed_attempts");
      localStorage.removeItem("admin_lockout_expiry");
      sessionStorage.setItem("admin_authenticated", "true");
      return;
    }

    if (lockoutExpiry && now < lockoutExpiry) {
      const diff = lockoutExpiry - now;
      const totalSecs = Math.max(0, Math.ceil(diff / 1000));
      const days = Math.floor(totalSecs / (24 * 3600));
      const hours = Math.floor((totalSecs % (24 * 3600)) / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      
      const timeStr = `${days > 0 ? `${days}d ` : ""}${hours > 0 || days > 0 ? `${hours}h ` : ""}${mins > 0 || hours > 0 || days > 0 ? `${mins}m ` : ""}${secs}s`;
      setLoginError(`Acesso bloqueado. Tente novamente em ${timeStr}.`);
      return;
    }

    if (loginPassword === menuData.adminPassword) {
      setIsAuthenticated(true);
      setActiveAdminPassword(loginPassword);
      setLoginError("");
      setFailedAttempts(0);
      setLockoutExpiry(0);
      localStorage.removeItem("admin_failed_attempts");
      localStorage.removeItem("admin_lockout_expiry");
      sessionStorage.setItem("admin_authenticated", "true");
    } else {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      localStorage.setItem("admin_failed_attempts", String(nextAttempts));

      if (nextAttempts >= 10) {
        const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days lock (1 month)
        setLockoutExpiry(expiry);
        localStorage.setItem("admin_lockout_expiry", String(expiry));
        setLoginError("Acesso bloqueado por segurança por 30 dias após 10 tentativas incorretas.");
        
        // Notify about failed attempts (no backend in static mode)
        console.warn("[Security] 10 failed login attempts detected.");
      } else {
        setLoginError(`Senha incorreta. Tentativa ${nextAttempts} de 10.`);
      }
    }
  };

  // Log out of admin panel
  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsAdminMode(false);
    sessionStorage.removeItem("admin_authenticated");
    // Clean query param
    window.history.pushState({}, document.title, window.location.pathname);
  };

  // Trigger Admin view mode directly
  const enterAdminMode = () => {
    setIsAdminMode(true);
    const params = new URLSearchParams(window.location.search);
    params.set("admin", "true");
    window.history.pushState({}, document.title, `?${params.toString()}`);
    if (sessionStorage.getItem("admin_authenticated") === "true") {
      setIsAuthenticated(true);
    }
  };

  // Save menu data to Firebase Firestore (persists in the cloud)
  const saveMenuDataPermanently = async (newDataset: FullMenuDataset) => {
    setIsSaving(true);

    try {
      // Always enforce the correct admin password
      newDataset.adminPassword = "8111";

      // 1. Save to Firebase Firestore (cloud - permanent)
      const docRef = doc(db, "menu", "main");
      await setDoc(docRef, JSON.parse(JSON.stringify(newDataset)));
      console.log("[Firebase] Menu saved to Firestore.");

      // 2. Update local state and cache
      setMenuData(newDataset);
      localStorage.setItem("local_menu_data", JSON.stringify(newDataset));
      setActiveAdminPassword("8111");

      const now = new Date();
      setLastUpdated(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

      showToast("success", "Cardápio atualizado e salvo com sucesso!");
    } catch (e: any) {
      console.error(e);
      // Fallback: save to localStorage even if Firebase fails
      setMenuData(newDataset);
      localStorage.setItem("local_menu_data", JSON.stringify(newDataset));
      showToast("error", "Salvo apenas neste navegador (erro na nuvem). Verifique sua conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (type: "success" | "error", message: string) => {
    setSaveToast({ type, message });
    setTimeout(() => {
      setSaveToast(null);
    }, 4000);
  };

  // --- DISH / ITEM OPERATIONS ---

  const handleOpenAddDish = () => {
    setEditingDish(null);
    setDishForm({
      id: "prato-" + Date.now(),
      name: "",
      description: "",
      price: 20,
      image: imagePresets[0].url,
      categoryId: menuData.menuCategories[0]?.id || "destaques",
      subcategoryId: "",
      isHighlight: false,
      isOutOfStock: false
    });
    setIsDishModalOpen(true);
  };

  const handleOpenEditDish = (dish: MenuItem) => {
    setEditingDish(dish);
    setDishForm({ ...dish });
    setIsDishModalOpen(true);
  };

  const handleSaveDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishForm.name?.trim()) return;

    let updatedItems = [...menuData.menuItems];
    const finalForm: MenuItem = {
      id: dishForm.id || "prato-" + Date.now(),
      name: dishForm.name,
      description: dishForm.description || "",
      price: dishForm.price === undefined || dishForm.price === "" ? "A Consultar" : Number(dishForm.price),
      image: dishForm.image || imagePresets[0].url,
      categoryId: dishForm.categoryId || "destaques",
      subcategoryId: dishForm.subcategoryId || undefined,
      isHighlight: !!dishForm.isHighlight,
      isOutOfStock: !!dishForm.isOutOfStock
    };

    if (editingDish) {
      // Edit mode
      updatedItems = updatedItems.map((item) => (item.id === finalForm.id ? finalForm : item));
    } else {
      // Create mode
      updatedItems.push(finalForm);
    }

    const nextDataset = { ...menuData, menuItems: updatedItems };
    saveMenuDataPermanently(nextDataset);
    setIsDishModalOpen(false);
  };

  const handleDeleteDish = (id: string) => {
    if (window.confirm("Deseja realmente excluir este item do cardápio?")) {
      const updatedItems = menuData.menuItems.filter((item) => item.id !== id);
      const nextDataset = { ...menuData, menuItems: updatedItems };
      saveMenuDataPermanently(nextDataset);
    }
  };

  const handleToggleOutOfStock = (item: MenuItem) => {
    const updatedItems = menuData.menuItems.map((dish) =>
      dish.id === item.id ? { ...dish, isOutOfStock: !dish.isOutOfStock } : dish
    );
    const nextDataset = { ...menuData, menuItems: updatedItems };
    saveMenuDataPermanently(nextDataset);
  };

  // --- PROMOTION OPERATIONS ---

  const handleOpenAddPromo = () => {
    setEditingPromo(null);
    setPromoForm({
      id: "promo-" + Date.now(),
      title: "",
      description: "",
      price: "",
      image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
      isArchived: false
    });
    setIsPromoModalOpen(true);
  };

  const handleOpenEditPromo = (promo: DailyPromotion) => {
    setEditingPromo(promo);
    setPromoForm({ ...promo });
    setIsPromoModalOpen(true);
  };

  const handleSavePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoForm.title?.trim() || !promoForm.description?.trim()) return;

    let updatedPromos = [...(menuData.promotions || [])];
    const finalPromo: DailyPromotion = {
      id: promoForm.id || "promo-" + Date.now(),
      title: promoForm.title,
      description: promoForm.description,
      price: promoForm.price || undefined,
      image: promoForm.image || "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
      isArchived: !!promoForm.isArchived
    };

    if (editingPromo) {
      updatedPromos = updatedPromos.map((p) => (p.id === finalPromo.id ? finalPromo : p));
      showToast("success", "Promoção editada com sucesso!");
    } else {
      updatedPromos.push(finalPromo);
      showToast("success", "Promoção cadastrada com sucesso!");
    }

    const nextDataset = { ...menuData, promotions: updatedPromos };
    saveMenuDataPermanently(nextDataset);
    setIsPromoModalOpen(false);
  };

  const handleToggleArchivePromo = (promo: DailyPromotion) => {
    const updatedPromos = (menuData.promotions || []).map((p) =>
      p.id === promo.id ? { ...p, isArchived: !p.isArchived } : p
    );
    const nextDataset = { ...menuData, promotions: updatedPromos };
    saveMenuDataPermanently(nextDataset);
    showToast("success", promo.isArchived ? "Promoção ativada (visível no cardápio)!" : "Promoção arquivada (escondida do cliente)!");
  };

  const handleDeletePromo = (id: string) => {
    if (window.confirm("Deseja realmente excluir esta promoção?")) {
      const updatedPromos = (menuData.promotions || []).filter((p) => p.id !== id);
      const nextDataset = { ...menuData, promotions: updatedPromos };
      saveMenuDataPermanently(nextDataset);
      showToast("success", "Promoção excluída com sucesso!");
    }
  };

  // --- CATEGORY OPERATIONS ---

  const handleOpenAddCategory = (type: "main" | "beverage") => {
    setEditingCategory(null);
    setCategoryType(type);
    setCategoryForm({
      id: "categoria-" + Date.now(),
      name: ""
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: MenuCategory, type: "main" | "beverage") => {
    setEditingCategory(cat);
    setCategoryType(type);
    setCategoryForm({ ...cat });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name?.trim()) return;

    const finalForm: MenuCategory = {
      id: categoryForm.id || "cat-" + Date.now(),
      name: categoryForm.name
    };

    let nextDataset = { ...menuData };

    if (categoryType === "main") {
      let list = [...menuData.menuCategories];
      if (editingCategory) {
        list = list.map((c) => (c.id === finalForm.id ? finalForm : c));
      } else {
        list.push(finalForm);
      }
      nextDataset.menuCategories = list;
    } else {
      let list = [...menuData.beverageSubcategories];
      if (editingCategory) {
        list = list.map((c) => (c.id === finalForm.id ? finalForm : c));
      } else {
        list.push(finalForm);
      }
      nextDataset.beverageSubcategories = list;
    }

    saveMenuDataPermanently(nextDataset);
    setIsCategoryModalOpen(false);
  };

  const handleDeleteCategory = (id: string, type: "main" | "beverage") => {
    const confirmation = window.confirm(
      `Deseja realmente remover esta categoria? Itens vinculados a ela continuarão no banco mas não serão mostrados até serem re-categorizados.`
    );
    if (confirmation) {
      let nextDataset = { ...menuData };
      if (type === "main") {
        nextDataset.menuCategories = menuData.menuCategories.filter((c) => c.id !== id);
      } else {
        nextDataset.beverageSubcategories = menuData.beverageSubcategories.filter((c) => c.id !== id);
      }
      saveMenuDataPermanently(nextDataset);
    }
  };

  // --- GALLERY OPERATIONS ---

  const handleOpenAddGallery = () => {
    setEditingGallery(null);
    setGalleryForm({
      id: "gal-" + Date.now(),
      title: "",
      image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80"
    });
    setIsGalleryModalOpen(true);
  };

  const handleOpenEditGallery = (gal: GalleryItem) => {
    setEditingGallery(gal);
    setGalleryForm({ ...gal });
    setIsGalleryModalOpen(true);
  };

  const handleSaveGallery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryForm.title?.trim()) return;

    const finalForm: GalleryItem = {
      id: galleryForm.id || "gal-" + Date.now(),
      title: galleryForm.title,
      image: galleryForm.image || ""
    };

    let list = [...menuData.galleryItems];
    if (editingGallery) {
      list = list.map((g) => (g.id === finalForm.id ? finalForm : g));
    } else {
      list.push(finalForm);
    }

    const nextDataset = { ...menuData, galleryItems: list };
    saveMenuDataPermanently(nextDataset);
    setIsGalleryModalOpen(false);
  };

  const handleDeleteGallery = (id: string) => {
    if (window.confirm("Remover esta imagem da galeria?")) {
      const list = menuData.galleryItems.filter((g) => g.id !== id);
      const nextDataset = { ...menuData, galleryItems: list };
      saveMenuDataPermanently(nextDataset);
    }
  };

  // --- GENERAL RESTAURANT INFO SAVING ---

  const handleUpdateInfoField = (field: keyof RestaurantInfo, value: any) => {
    setMenuData((prev) => ({
      ...prev,
      restaurantInfo: {
        ...prev.restaurantInfo,
        [field]: value
      }
    }));
  };

  const handleSaveGeneralInfo = () => {
    saveMenuDataPermanently(menuData);
  };

  const handleUpdateContactField = (field: keyof RestaurantInfo["contact"], value: any) => {
    setMenuData((prev) => ({
      ...prev,
      restaurantInfo: {
        ...prev.restaurantInfo,
        contact: {
          ...prev.restaurantInfo.contact,
          [field]: value
        }
      }
    }));
  };

  const handleUpdateHourField = (index: number, field: "days" | "time", value: string) => {
    const hours = [...menuData.restaurantInfo.contact.hours];
    hours[index] = { ...hours[index], [field]: value };
    handleUpdateInfoField("contact", { ...menuData.restaurantInfo.contact, hours });
  };

  const handleAddHourRow = () => {
    const hours = [...menuData.restaurantInfo.contact.hours, { days: "Nova Linha", time: "18:00 às 22:00" }];
    handleUpdateInfoField("contact", { ...menuData.restaurantInfo.contact, hours });
  };

  const handleRemoveHourRow = (index: number) => {
    const hours = menuData.restaurantInfo.contact.hours.filter((_, i) => i !== index);
    handleUpdateInfoField("contact", { ...menuData.restaurantInfo.contact, hours });
  };

  // Helper smooth scroll
  const scrollToCategory = (categoryId: string) => {
    if (searchQuery.trim() !== "") {
      setSearchQuery("");
      setTimeout(() => {
        const el = menuSectionsRef.current[categoryId];
        if (el) {
          const offset = el.getBoundingClientRect().top + window.scrollY - 120;
          window.scrollTo({ top: offset, behavior: "smooth" });
        }
      }, 100);
    } else {
      const el = menuSectionsRef.current[categoryId];
      if (el) {
        const offset = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: offset, behavior: "smooth" });
      }
    }
    setActiveCategory(categoryId);
  };

  const toggleBeverageSub = (subId: string) => {
    setOpenBeverageSubs((prev) => ({
      ...prev,
      [subId]: !prev[subId],
    }));
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Search filter
  const filteredItems = menuData.menuItems.filter((item) => {
    if (searchQuery.trim() === "") return true;
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query)
    );
  });

  const hasItemsInSearch = (categoryId: string) => {
    if (searchQuery.trim() === "") return true;
    if (categoryId === "destaques") {
      return filteredItems.some((item) => item.isHighlight && item.categoryId === "baguetes");
    }
    return filteredItems.some((item) => item.categoryId === categoryId);
  };

  const formatPrice = (val?: any) => {
    if (val === undefined || val === null) return "Sob Consulta";
    if (val === "A Consultar" || isNaN(Number(val))) return "Sob Consulta";
    return Number(val).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  // Client QR URL
  const getClientURL = () => {
    if (qrUrlType === "custom" && customQrUrl.trim() !== "") {
      return customQrUrl.trim();
    }
    return window.location.origin;
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = "dom_eduardo_qrcode.png";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  // ==========================================
  // RENDER: ADMIN AUTHENTICATION LOGIN
  // ==========================================
  if (isAdminMode && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-brand-navy flex flex-col items-center justify-center p-6 relative font-sans text-white">
        {/* Abstract luxury ambient lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-brand-gold/15 rounded-full blur-[110px]" />
        
        <div className="relative z-10 w-full max-w-md bg-brand-navy-light border border-brand-gold/20 rounded-2xl p-8 shadow-2xl text-center">
          <DomEduardoLogo className="w-40 h-40 mx-auto mb-6" light={true} />
          
          <h2 className="font-serif text-2xl font-semibold text-white tracking-tight mb-2">
            Painel do Proprietário
          </h2>
          <p className="font-sans text-stone-400 text-xs leading-relaxed mb-6">
            Insira a senha mestra para editar o cardápio, pratos, preços, localização e horários em tempo real.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-left text-[10px] uppercase tracking-widest text-brand-gold font-bold mb-1.5">
                Senha Administrativa
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder={lockoutExpiry > currentTime ? "Acesso Bloqueado..." : "Digite a senha..."}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setLoginError("");
                  }}
                  disabled={lockoutExpiry > currentTime}
                  className={`w-full px-4 py-3 border border-brand-gold/20 rounded-xl font-sans text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-all ${
                    lockoutExpiry > currentTime ? "opacity-50 cursor-not-allowed bg-stone-900" : "bg-brand-navy"
                  }`}
                  required
                />
                <Lock className="absolute right-4 top-3.5 w-4.5 h-4.5 text-stone-500" />
              </div>

              {lockoutExpiry > currentTime && (
                <p className="text-red-400 text-left text-xs font-sans mt-2.5 flex items-center gap-1.5 bg-red-950/35 border border-red-900/30 p-2.5 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>
                    Bloqueado por segurança. Tente novamente em:{" "}
                    <strong className="text-white font-mono">
                      {(() => {
                        const diff = lockoutExpiry - currentTime;
                        const totalSecs = Math.max(0, Math.ceil(diff / 1000));
                        const days = Math.floor(totalSecs / (24 * 3600));
                        const hours = Math.floor((totalSecs % (24 * 3600)) / 3600);
                        const mins = Math.floor((totalSecs % 3600) / 60);
                        const secs = totalSecs % 60;
                        
                        const parts = [];
                        if (days > 0) parts.push(`${days}d`);
                        if (hours > 0 || days > 0) parts.push(`${hours}h`);
                        if (mins > 0 || hours > 0 || days > 0) parts.push(`${mins}m`);
                        parts.push(`${secs}s`);
                        return parts.join(" ");
                      })()}
                    </strong>
                  </span>
                </p>
              )}
              {loginError && !(lockoutExpiry > currentTime) && (
                <p className="text-red-400 text-left text-xs font-sans mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {loginError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={lockoutExpiry > currentTime}
              className={`w-full py-3 font-bold text-sm tracking-wider uppercase rounded-xl transition-all duration-200 shadow-md ${
                lockoutExpiry > currentTime
                  ? "bg-stone-700 text-stone-400 cursor-not-allowed opacity-50"
                  : "bg-brand-gold text-brand-navy hover:bg-brand-gold-light cursor-pointer"
              }`}
            >
              Acessar Sistema
            </button>
          </form>

          <button
            onClick={() => setIsAdminMode(false)}
            className="mt-6 font-sans text-xs text-stone-400 hover:text-brand-gold transition-colors inline-flex items-center gap-1"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Voltar para o Cardápio do Cliente
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: ADMIN CONSOLE EDIT VIEW
  // ==========================================
  if (isAdminMode && isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-100 font-sans text-brand-navy antialiased pb-12">
        {/* ADMIN TOP CONTROL BAR */}
        <header className="bg-brand-navy text-white sticky top-0 z-40 shadow-md border-b-2 border-brand-gold/40">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <DomEduardoLogo className="w-16 h-16" light={true} />
              <div>
                <h1 className="font-serif text-lg font-bold text-white leading-snug flex items-center gap-1.5">
                  Painel de Controle
                  <span className="text-[10px] bg-brand-gold/20 text-brand-gold border border-brand-gold/30 px-2 py-0.5 rounded-full font-sans font-semibold tracking-wider uppercase">
                    Administrador
                  </span>
                </h1>
                <p className="text-stone-300 text-xs">Dom Eduardo Restobar • Edição em tempo real</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* LAST UPDATED INDICATOR */}
              <div className="flex items-center gap-2 bg-brand-navy-light/60 border border-white/10 rounded-lg px-3 py-2 text-xs font-sans font-medium select-none text-stone-200">
                <span className="text-emerald-400">Salvo Localmente</span>
                <span className="text-white/40 font-mono text-[10px] pl-1.5 border-l border-white/15">
                  At: {lastUpdated}
                </span>
              </div>

              {/* Client Preview button */}
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  const params = new URLSearchParams(window.location.search);
                  params.delete("admin");
                  window.history.pushState({}, document.title, window.location.pathname);
                }}
                className="px-4 py-2 bg-brand-navy-light text-brand-gold border border-brand-gold/30 hover:border-brand-gold/80 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors duration-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                Ver como Cliente
              </button>

              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-950/40 hover:bg-red-950/80 text-red-300 border border-red-900/40 hover:border-red-500 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors duration-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          {/* TOAST SAVED NOTIFICATION */}
          <AnimatePresence>
            {saveToast && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-6 py-3.5 rounded-xl shadow-2xl border text-sm font-sans ${
                  saveToast.type === "success"
                    ? "bg-emerald-950 text-emerald-100 border-emerald-500/40"
                    : "bg-red-950 text-red-100 border-red-500/40"
                }`}
              >
                {saveToast.type === "success" ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                <span>{saveToast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MAIN TABS MENU */}
          <div className="flex border-b border-stone-200 overflow-x-auto no-scrollbar mb-8 gap-1">
            {[
              { id: "geral", label: "Infos do Restaurante", icon: Sparkles },
              { id: "pratos", label: "Gerenciar Pratos", icon: UtensilsCrossed },
              { id: "promocoes", label: "Promoções do Dia", icon: Tag },
              { id: "categorias", label: "Categorias", icon: ChevronDown },
              { id: "galeria", label: "Galeria de Fotos", icon: ImageIcon },
              { id: "config", label: "QR Code & Senha", icon: QrCode },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setAdminTab(tab.id as any)}
                  className={`px-5 py-3 border-b-2 font-sans text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                    adminTab === tab.id
                      ? "border-brand-gold text-brand-navy bg-white/50"
                      : "border-transparent text-stone-500 hover:text-brand-navy hover:bg-stone-200/50"
                  }`}
                >
                  <Icon className="w-4 h-4 text-brand-gold" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* SAVING LOADER OVERLAY */}
          {isSaving && (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-xs z-50 flex items-center justify-center">
              <div className="bg-white px-6 py-4 rounded-xl border border-stone-200 shadow-2xl flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
                <span className="font-sans text-sm font-semibold text-brand-navy">Salvando alterações permanentemente...</span>
              </div>
            </div>
          )}

          {/* TAB 1: RESTAURANT GENERAL INFORMATION */}
          {adminTab === "geral" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Core Presentation Info */}
              <div className="lg:col-span-2 space-y-6 bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm">
                <h3 className="font-serif text-xl font-bold border-b border-stone-100 pb-3 text-brand-navy flex items-center gap-2">
                  <Sparkle className="w-5 h-5 text-brand-gold fill-brand-gold" />
                  Apresentação Institucional
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Nome do Restaurante</label>
                    <input
                      type="text"
                      value={menuData.restaurantInfo.name}
                      onChange={(e) => handleUpdateInfoField("name", e.target.value)}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Slogan / Frase de Impacto</label>
                    <input
                      type="text"
                      value={menuData.restaurantInfo.tagline}
                      onChange={(e) => handleUpdateInfoField("tagline", e.target.value)}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Ano de Fundação</label>
                    <input
                      type="number"
                      value={menuData.restaurantInfo.foundedYear}
                      onChange={(e) => handleUpdateInfoField("foundedYear", Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Foto de Capa (Hero)</label>
                    <div className="space-y-2">
                      <div className="relative border-2 border-dashed border-stone-200 hover:border-brand-gold/60 rounded-xl p-3 bg-stone-50/50 hover:bg-stone-50 transition-colors flex flex-col items-center justify-center cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, (base64) => handleUpdateInfoField("coverImage", base64), 1400, 0.90)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          id="cover-image-upload"
                        />
                        <Upload className="w-5 h-5 text-stone-400 mb-1" />
                        <span className="text-[11px] font-medium text-stone-600">Escolha ou tire foto do celular/PC</span>
                        <span className="text-[9px] text-stone-400">Arraste ou clique para selecionar</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Ou cole o link (URL) da foto aqui"
                        value={menuData.restaurantInfo.coverImage}
                        onChange={(e) => handleUpdateInfoField("coverImage", e.target.value)}
                        className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Sobre o Restaurante (História/Proposta)</label>
                  <textarea
                    rows={5}
                    value={menuData.restaurantInfo.aboutText}
                    onChange={(e) => handleUpdateInfoField("aboutText", e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold leading-relaxed"
                  />
                </div>

                {/* Cover Image Preview */}
                <div className="mt-4 rounded-xl overflow-hidden aspect-[16/6] bg-stone-100 relative">
                  <img src={menuData.restaurantInfo.coverImage || undefined} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold uppercase tracking-wider">Preview da Foto de Capa</span>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-stone-100">
                  <button
                    onClick={handleSaveGeneralInfo}
                    className="px-6 py-2.5 bg-brand-navy text-white hover:bg-brand-navy-light rounded-lg font-bold text-xs tracking-wider uppercase inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-brand-gold" />
                    Salvar Informações
                  </button>
                </div>
              </div>

              {/* Sidebar Hours, Map, Contacts */}
              <div className="space-y-6">
                {/* Contacts Form */}
                <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                  <h3 className="font-serif text-lg font-bold border-b border-stone-100 pb-2 text-brand-navy flex items-center gap-1.5">
                    <Phone className="w-4.5 h-4.5 text-brand-gold" />
                    Contatos & Redes
                  </h3>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Instagram (@usuario)</label>
                    <input
                      type="text"
                      value={menuData.restaurantInfo.contact.instagram}
                      onChange={(e) => handleUpdateContactField("instagram", e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Link do Instagram</label>
                    <input
                      type="text"
                      value={menuData.restaurantInfo.contact.instagramUrl}
                      onChange={(e) => handleUpdateContactField("instagramUrl", e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">WhatsApp Formatado</label>
                    <input
                      type="text"
                      value={menuData.restaurantInfo.contact.whatsapp}
                      onChange={(e) => handleUpdateContactField("whatsapp", e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">WhatsApp Link Direto</label>
                    <input
                      type="text"
                      value={menuData.restaurantInfo.contact.whatsappUrl}
                      onChange={(e) => handleUpdateContactField("whatsappUrl", e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Telefone Fixo</label>
                    <input
                      type="text"
                      value={menuData.restaurantInfo.contact.phone}
                      onChange={(e) => handleUpdateContactField("phone", e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Endereço Completo</label>
                    <input
                      type="text"
                      value={menuData.restaurantInfo.contact.address}
                      onChange={(e) => handleUpdateContactField("address", e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Link Google Maps</label>
                    <input
                      type="text"
                      value={menuData.restaurantInfo.contact.addressMapUrl}
                      onChange={(e) => handleUpdateContactField("addressMapUrl", e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs"
                    />
                  </div>
                </div>

                {/* Hours Management */}
                <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <h3 className="font-serif text-lg font-bold text-brand-navy flex items-center gap-1.5">
                      <Clock className="w-4.5 h-4.5 text-brand-gold" />
                      Funcionamento
                    </h3>
                    <button
                      onClick={handleAddHourRow}
                      className="text-xs text-brand-gold font-bold uppercase tracking-wider hover:text-brand-gold-dark flex items-center gap-0.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>

                  <div className="space-y-3">
                    {menuData.restaurantInfo.contact.hours.map((row, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={row.days}
                          onChange={(e) => handleUpdateHourField(i, "days", e.target.value)}
                          placeholder="Dias"
                          className="w-1/2 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-xs"
                        />
                        <input
                          type="text"
                          value={row.time}
                          onChange={(e) => handleUpdateHourField(i, "time", e.target.value)}
                          placeholder="Horário"
                          className="w-1/2 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-xs"
                        />
                        <button
                          onClick={() => handleRemoveHourRow(i)}
                          className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Global Save Button for sidebar */}
                <button
                  onClick={handleSaveGeneralInfo}
                  className="w-full py-3 bg-brand-navy hover:bg-brand-navy-light text-white rounded-xl font-bold text-xs tracking-wider uppercase inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Save className="w-4 h-4 text-brand-gold" />
                  Salvar Contatos & Horários
                </button>
              </div>
            </div>
          )}

          {/* TAB: DAILY PROMOTIONS */}
          {adminTab === "promocoes" && (
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-100 pb-4">
                <div>
                  <h3 className="font-serif text-xl font-bold text-brand-navy">Promoções do Dia</h3>
                  <p className="text-stone-500 text-xs">Total: {(menuData.promotions || []).length} cadastrada(s)</p>
                </div>
                <button
                  onClick={handleOpenAddPromo}
                  className="px-4 py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-bold text-xs tracking-wider uppercase rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Promoção
                </button>
              </div>

              {(menuData.promotions || []).length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-2xl">
                  <Tag className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500 text-sm font-medium">Nenhuma promoção do dia cadastrada.</p>
                  <button
                    onClick={handleOpenAddPromo}
                    className="mt-3 text-xs text-brand-gold font-bold uppercase tracking-wider hover:underline cursor-pointer"
                  >
                    Cadastrar a primeira promoção agora
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Foto</th>
                        <th className="py-3 px-4">Título</th>
                        <th className="py-3 px-4">Descrição</th>
                        <th className="py-3 px-4">Preço/Regra</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(menuData.promotions || []).map((promo) => (
                        <tr key={promo.id} className="text-sm hover:bg-stone-50/50 transition-colors">
                          <td className="py-4 px-4">
                            {promo.image ? (
                              <img
                                src={promo.image}
                                alt={promo.title}
                                className="w-12 h-12 rounded-lg object-cover border border-stone-200"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 font-semibold text-brand-navy max-w-[180px] truncate" title={promo.title}>
                            {promo.title}
                          </td>
                          <td className="py-4 px-4 text-xs text-stone-500 max-w-[250px] truncate" title={promo.description}>
                            {promo.description}
                          </td>
                          <td className="py-4 px-4 text-xs font-semibold text-stone-600">
                            {promo.price || "—"}
                          </td>
                          <td className="py-4 px-4">
                            {promo.isArchived ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                                Arquivada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Ativa
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditPromo(promo)}
                                className="p-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 hover:border-stone-300 rounded text-stone-600 hover:text-brand-navy transition-all cursor-pointer"
                                title="Editar"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleArchivePromo(promo)}
                                className={`p-1.5 border rounded transition-all cursor-pointer ${
                                  promo.isArchived
                                    ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 hover:border-emerald-300 text-emerald-700"
                                    : "bg-amber-50 hover:bg-amber-100 border-amber-200 hover:border-amber-300 text-amber-700"
                                }`}
                                title={promo.isArchived ? "Ativar promoção" : "Arquivar promoção"}
                              >
                                {promo.isArchived ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDeletePromo(promo.id)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded text-red-600 hover:text-red-700 transition-all cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANAGE DISHES */}
          {adminTab === "pratos" && (
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-100 pb-4">
                <div>
                  <h3 className="font-serif text-xl font-bold text-brand-navy">Pratos cadastrados</h3>
                  <p className="text-stone-500 text-xs">Total: {menuData.menuItems.length} pratos/bebidas</p>
                </div>
                <button
                  onClick={handleOpenAddDish}
                  className="px-4 py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-bold text-xs tracking-wider uppercase rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Prato
                </button>
              </div>

              {/* Search within Admin manage panel */}
              <div className="max-w-md relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-stone-400 pointer-events-none">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar por nome na tabela..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-lg text-sm"
                />
              </div>

              {/* Dishes Grid/Table List */}
              <div className="overflow-x-auto border border-stone-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-sans text-[10px] font-bold uppercase tracking-wider border-b border-stone-200">
                      <th className="py-3 px-4 w-16">Foto</th>
                      <th className="py-3 px-4">Nome / Descrição</th>
                      <th className="py-3 px-4 w-36">Categoria</th>
                      <th className="py-3 px-4 w-28 text-right">Preço</th>
                      <th className="py-3 px-4 w-16 text-center">Destaque</th>
                      <th className="py-3 px-4 w-28 text-center">Status</th>
                      <th className="py-3 px-4 w-24 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-sans text-xs">
                    {filteredItems.map((item) => {
                      const categoryName = menuData.menuCategories.find((c) => c.id === item.categoryId)?.name || item.categoryId;
                      const subcategoryName = item.subcategoryId
                        ? menuData.beverageSubcategories.find((s) => s.id === item.subcategoryId)?.name
                        : null;

                      return (
                        <tr key={item.id} className={`hover:bg-stone-50/50 transition-colors ${item.isOutOfStock ? "bg-red-50/20" : ""}`}>
                          <td className="py-3 px-4">
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 relative">
                              <img src={item.image || undefined} alt={item.name} className={`w-full h-full object-cover ${item.isOutOfStock ? "opacity-55 grayscale" : ""}`} />
                              {item.isOutOfStock && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <span className="text-[8px] text-white font-bold tracking-tight bg-red-600 px-1 rounded">OUT</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-sm">
                            <h4 className={`font-bold text-brand-navy text-sm mb-0.5 ${item.isOutOfStock ? "text-stone-400 line-through decoration-stone-300" : ""}`}>{item.name}</h4>
                            <p className="text-stone-500 font-light leading-relaxed line-clamp-2">{item.description}</p>
                          </td>
                          <td className="py-3 px-4 text-stone-600">
                            <span className="font-medium block">{categoryName}</span>
                            {subcategoryName && (
                              <span className="text-[10px] text-brand-gold bg-brand-navy/5 px-1.5 py-0.5 rounded font-bold">
                                {subcategoryName}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-brand-navy">
                            {formatPrice(item.price)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.isHighlight ? (
                              <span className="inline-flex p-1 rounded-full bg-amber-50 text-amber-500 border border-amber-200" title="Destaque">
                                <Sparkles className="w-3.5 h-3.5 fill-amber-500" />
                              </span>
                            ) : (
                              <span className="text-stone-300">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleOutOfStock(item)}
                              className={`px-2.5 py-1 text-[9px] font-extrabold rounded-full border transition-all duration-200 uppercase tracking-wider ${
                                item.isOutOfStock
                                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                  : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                              }`}
                              title={item.isOutOfStock ? "Marcar como Disponível" : "Marcar como Esgotado"}
                            >
                              {item.isOutOfStock ? "🔴 Esgotado" : "🟢 Ativo"}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditDish(item)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDish(item.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-stone-500 font-light">
                          Nenhum prato encontrado com o filtro atual.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MANAGE CATEGORIES */}
          {adminTab === "categorias" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Main Categories */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-brand-navy">Categorias Principais</h3>
                    <p className="text-stone-500 text-xs">Ex: Pratos, Massas, Petiscos...</p>
                  </div>
                  <button
                    onClick={() => handleOpenAddCategory("main")}
                    className="text-xs text-brand-gold font-bold uppercase tracking-wider hover:text-brand-gold-dark flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                <div className="divide-y divide-stone-100">
                  {menuData.menuCategories.map((cat) => (
                    <div key={cat.id} className="py-3 flex items-center justify-between text-xs font-sans text-brand-navy">
                      <span className="font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
                        {cat.name}
                        <span className="text-[10px] text-stone-400 font-mono">({cat.id})</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditCategory(cat, "main")}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {/* Protect Highlights from deletion as it has special visual rendering */}
                        {cat.id !== "destaques" && (
                          <button
                            onClick={() => handleDeleteCategory(cat.id, "main")}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Beverage Subcategories */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-brand-navy">Subcategorias de Bebidas</h3>
                    <p className="text-stone-500 text-xs">Ex: Cervejas, Drinks, Vinhos...</p>
                  </div>
                  <button
                    onClick={() => handleOpenAddCategory("beverage")}
                    className="text-xs text-brand-gold font-bold uppercase tracking-wider hover:text-brand-gold-dark flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                <div className="divide-y divide-stone-100">
                  {menuData.beverageSubcategories.map((sub) => (
                    <div key={sub.id} className="py-3 flex items-center justify-between text-xs font-sans text-brand-navy">
                      <span className="font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-navy" />
                        {sub.name}
                        <span className="text-[10px] text-stone-400 font-mono">({sub.id})</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditCategory(sub, "beverage")}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(sub.id, "beverage")}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MANAGE GALLERY */}
          {adminTab === "galeria" && (
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div>
                  <h3 className="font-serif text-xl font-bold text-brand-navy">Galeria do Estabelecimento</h3>
                  <p className="text-stone-500 text-xs">As fotos que contam a história do restaurante no rodapé do site.</p>
                </div>
                <button
                  onClick={handleOpenAddGallery}
                  className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-bold text-xs tracking-wider uppercase rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Foto
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {menuData.galleryItems.map((gal) => (
                  <div key={gal.id} className="border border-stone-200 rounded-xl overflow-hidden shadow-xs flex flex-col bg-stone-50">
                    <div className="aspect-video relative w-full overflow-hidden bg-stone-100 border-b border-stone-100">
                      <img src={gal.image || undefined} alt={gal.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <h4 className="font-sans text-xs font-bold text-brand-navy mb-3 line-clamp-1">{gal.title}</h4>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditGallery(gal)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => handleDeleteGallery(gal.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: QR CODE & PASSWORD CONFIGURATION */}
          {adminTab === "config" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* QR Code Printable Section */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm space-y-6 flex flex-col items-center text-center">
                <h3 className="font-serif text-lg font-bold text-brand-navy w-full border-b border-stone-100 pb-3 text-left">
                  QR Code de Mesa do Cliente
                </h3>
                
                <p className="font-sans text-stone-500 text-xs max-w-sm leading-relaxed">
                  Este QR Code é <strong>100% permanente e nunca muda</strong>, pois ele aponta apenas para o endereço web do seu cardápio. Você pode imprimi-lo e colocá-lo nas mesas com segurança: qualquer alteração de pratos, bebidas ou preços feita no painel será atualizada para os clientes instantaneamente sem alterar o QR Code!
                </p>

                {/* URL TYPE SELECTOR */}
                <div className="w-full text-left space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                  <span className="block text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Configuração do Endereço (URL)
                  </span>
                  
                  <div className="space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="qrUrlType"
                        value="public"
                        checked={qrUrlType === "public"}
                        onChange={() => setQrUrlType("public")}
                        className="mt-0.5 text-brand-gold focus:ring-brand-gold"
                      />
                      <div>
                        <span className="text-xs font-bold text-brand-navy block">Link Atual (Recomendado)</span>
                        <span className="text-[10px] text-stone-500 block leading-relaxed">
                          Para clientes escanearem. Usa o endereço atual do site (ex: seu link no Netlify).
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="qrUrlType"
                        value="custom"
                        checked={qrUrlType === "custom"}
                        onChange={() => setQrUrlType("custom")}
                        className="mt-0.5 text-brand-gold focus:ring-brand-gold"
                      />
                      <div>
                        <span className="text-xs font-bold text-brand-navy block">Endereço Personalizado</span>
                        <span className="text-[10px] text-stone-500 block leading-relaxed">
                          Insira um domínio ou link próprio se você já tiver publicado (ex: https://meu-cardapio.com).
                        </span>
                      </div>
                    </label>
                  </div>

                  {qrUrlType === "custom" && (
                    <div className="mt-3">
                      <input
                        type="text"
                        placeholder="https://seu-dominio.com"
                        value={customQrUrl}
                        onChange={(e) => setCustomQrUrl(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold"
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white border-2 border-brand-gold/20 rounded-2xl shadow-md flex flex-col items-center">
                  <div className="p-2 bg-white rounded-lg">
                    <QRCodeCanvas
                      id="qr-canvas"
                      value={getClientURL()}
                      size={192}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-stone-400 select-all mt-2 break-all max-w-xs">{getClientURL()}</span>
                </div>

                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <button
                    onClick={downloadQRCode}
                    className="px-4 py-2.5 bg-brand-gold text-brand-navy hover:bg-brand-gold-dark font-bold text-xs tracking-wider uppercase rounded-lg text-center shadow-xs transition-colors cursor-pointer block w-full"
                  >
                    Download QR Code (Imagem)
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs tracking-wider uppercase rounded-lg text-center transition-colors cursor-pointer"
                  >
                    Imprimir Página / QR Code
                  </button>
                </div>
              </div>

              {/* Password configuration panel */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm space-y-6">
                <h3 className="font-serif text-lg font-bold text-brand-navy border-b border-stone-100 pb-3">
                  Configurações de Segurança
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                      Nova Senha de Acesso ao Painel
                    </label>
                    <input
                      type="password"
                      placeholder="Deixe em branco para não alterar"
                      value={menuData.adminPassword}
                      onChange={(e) => setMenuData(prev => ({ ...prev, adminPassword: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold"
                    />
                    <span className="text-[10px] text-stone-400 block mt-1 leading-relaxed">
                      Lembre-se desta senha para acessar o painel administrador no rodapé do site futuramente.
                    </span>
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex justify-end">
                    <button
                      onClick={() => saveMenuDataPermanently(menuData)}
                      className="px-6 py-2.5 bg-brand-navy text-white hover:bg-brand-navy-light rounded-lg font-bold text-xs tracking-wider uppercase inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4 text-brand-gold" />
                      Salvar Nova Senha
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            MODAL FORM: DISH / MENU ITEM ADD & EDIT
            ======================================================== */}
        <AnimatePresence>
          {isDishModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-navy/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Modal Header */}
                <div className="bg-brand-navy text-white px-6 py-4 flex items-center justify-between border-b border-brand-gold/30">
                  <h3 className="font-serif text-lg font-bold">
                    {editingDish ? `Editar Prato: ${editingDish.name}` : "Adicionar Novo Prato"}
                  </h3>
                  <button
                    onClick={() => setIsDishModalOpen(false)}
                    className="p-1 rounded-full text-stone-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Scrollable Body */}
                <form onSubmit={handleSaveDish} className="p-6 overflow-y-auto space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Nome do Prato*</label>
                      <input
                        type="text"
                        required
                        value={dishForm.name || ""}
                        onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                        placeholder="Ex: Baguete de Costela"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Preço (R$)*</label>
                      <input
                        type="text"
                        value={dishForm.price === "A Consultar" ? "" : dishForm.price || ""}
                        onChange={(e) => setDishForm({ ...dishForm, price: e.target.value })}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                        placeholder="Ex: 21.99 ou deixe em branco para Sob Consulta"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Categoria Principal*</label>
                      <select
                        value={dishForm.categoryId || ""}
                        onChange={(e) => setDishForm({ ...dishForm, categoryId: e.target.value })}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                      >
                        {menuData.menuCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Subcategoria de Bebida (Opcional)</label>
                      <select
                        value={dishForm.subcategoryId || ""}
                        onChange={(e) => setDishForm({ ...dishForm, subcategoryId: e.target.value || undefined })}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                      >
                        <option value="">Nenhuma (Comida normal)</option>
                        {menuData.beverageSubcategories.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Foto do Prato*</label>
                    <div className="space-y-2 mb-2">
                      <div className="relative border-2 border-dashed border-stone-200 hover:border-brand-gold/60 rounded-xl p-3 bg-stone-50/50 hover:bg-stone-50 transition-colors flex flex-col items-center justify-center cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, (base64) => setDishForm({ ...dishForm, image: base64 }), 800, 0.90)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          id="dish-image-upload"
                        />
                        <Upload className="w-5 h-5 text-stone-400 mb-1" />
                        <span className="text-[11px] font-medium text-stone-600">Enviar foto direto do celular/computador</span>
                        <span className="text-[9px] text-stone-400">Arraste ou toque para selecionar a foto</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          required
                          value={dishForm.image || ""}
                          onChange={(e) => setDishForm({ ...dishForm, image: e.target.value })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                          placeholder="Ou cole o link (URL) da foto"
                        />
                        {dishForm.image && (
                          <div className="w-10 h-10 rounded-lg border border-stone-200 overflow-hidden shrink-0 bg-stone-100">
                            <img src={dishForm.image || undefined} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Presets Grid */}
                    <div className="border border-stone-100 rounded-lg p-3 bg-stone-50">
                      <span className="block text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-2">Preset de Imagens de Alta Categoria (Toque para aplicar):</span>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {imagePresets.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setDishForm({ ...dishForm, image: preset.url })}
                            className={`aspect-square rounded-md overflow-hidden relative border hover:border-brand-gold transition-colors ${
                              dishForm.image === preset.url ? "border-brand-gold border-2 ring-1 ring-brand-gold" : "border-stone-200"
                            }`}
                            title={preset.name}
                          >
                            <img src={preset.url || undefined} alt={preset.name} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Descrição Detalhada do Prato (Ingredientes, modo de servir)</label>
                    <textarea
                      rows={3}
                      value={dishForm.description || ""}
                      onChange={(e) => setDishForm({ ...dishForm, description: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs leading-relaxed"
                      placeholder="Ex: Tiras de mignon salteadas com cebolas glaceadas no shoyu artesanal, gratinado com mix de queijos finos na baguete crocante."
                    />
                  </div>

                  <div className="flex flex-col gap-2 pt-1 border-t border-stone-100/50">
                    <button
                      type="button"
                      onClick={() => setDishForm({ ...dishForm, isHighlight: !dishForm.isHighlight })}
                      className="flex items-center gap-2 font-sans text-xs text-brand-navy select-none text-left"
                    >
                      {dishForm.isHighlight ? (
                        <CheckSquare className="w-4 h-4 text-brand-gold shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-stone-300 shrink-0" />
                      )}
                      <span>Marcar como <strong>Destaque da Casa</strong> (Mostrado no topo do cardápio)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDishForm({ ...dishForm, isOutOfStock: !dishForm.isOutOfStock })}
                      className="flex items-center gap-2 font-sans text-xs text-brand-navy select-none text-left"
                    >
                      {dishForm.isOutOfStock ? (
                        <CheckSquare className="w-4 h-4 text-red-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-stone-300 shrink-0" />
                      )}
                      <span className={dishForm.isOutOfStock ? "text-red-600 font-semibold animate-pulse" : ""}>
                        <strong>Marcar como Esgotado</strong> (Falta temporária de ingrediente)
                      </span>
                    </button>
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDishModalOpen(false)}
                      className="px-4 py-2 bg-stone-100 text-stone-700 font-semibold text-xs rounded-lg uppercase tracking-wider transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-brand-navy hover:bg-brand-navy-light text-white font-bold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    >
                      <Save className="w-4 h-4 text-brand-gold" />
                      Gravar no Cardápio
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================
            MODAL FORM: DAILY PROMOTIONS ADD & EDIT
            ======================================================== */}
        <AnimatePresence>
          {isPromoModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-navy/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Modal Header */}
                <div className="bg-brand-navy text-white px-6 py-4 flex items-center justify-between border-b border-brand-gold/30">
                  <h3 className="font-serif text-lg font-bold">
                    {editingPromo ? `Editar Promoção: ${editingPromo.title}` : "Adicionar Nova Promoção"}
                  </h3>
                  <button
                    onClick={() => setIsPromoModalOpen(false)}
                    className="p-1 rounded-full text-stone-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Scrollable Body */}
                <form onSubmit={handleSavePromo} className="p-6 overflow-y-auto space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Título da Promoção*</label>
                    <input
                      type="text"
                      required
                      value={promoForm.title || ""}
                      onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                      placeholder="Ex: Combo Imperdível de Baguetes"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Preço / Regra de Destaque (Opcional)</label>
                      <input
                        type="text"
                        value={promoForm.price || ""}
                        onChange={(e) => setPromoForm({ ...promoForm, price: e.target.value })}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                        placeholder="Ex: R$ 21,99 cada ou Grátis!"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <button
                        type="button"
                        onClick={() => setPromoForm({ ...promoForm, isArchived: !promoForm.isArchived })}
                        className="flex items-center gap-2 font-sans text-xs text-brand-navy select-none text-left"
                      >
                        {promoForm.isArchived ? (
                          <CheckSquare className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-stone-300 shrink-0" />
                        )}
                        <span><strong>Arquivar Promoção</strong> (Ocultar do cliente por enquanto)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Descrição Curta e Atraente*</label>
                    <textarea
                      rows={2}
                      required
                      value={promoForm.description || ""}
                      onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs leading-relaxed"
                      placeholder="Ex: Na compra de 4 Baguetes deliciosas e crocantes, leve 1 Coca-Cola de 1 Litro inteiramente grátis!"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Foto Ilustrativa da Promoção</label>
                    <div className="space-y-2 mb-2">
                      <div className="relative border-2 border-dashed border-stone-200 hover:border-brand-gold/60 rounded-xl p-3 bg-stone-50/50 hover:bg-stone-50 transition-colors flex flex-col items-center justify-center cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, (base64) => setPromoForm({ ...promoForm, image: base64 }), 800, 0.90)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          id="promo-image-upload"
                        />
                        <Upload className="w-5 h-5 text-stone-400 mb-1" />
                        <span className="text-[11px] font-medium text-stone-600">Enviar foto do celular/computador</span>
                        <span className="text-[9px] text-stone-400">Arraste ou toque para selecionar a foto</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={promoForm.image || ""}
                          onChange={(e) => setPromoForm({ ...promoForm, image: e.target.value })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                          placeholder="Ou cole o link (URL) da foto"
                        />
                        {promoForm.image && (
                          <div className="w-10 h-10 rounded-lg border border-stone-200 overflow-hidden shrink-0 bg-stone-100">
                            <img src={promoForm.image || undefined} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Presets Grid */}
                    <div className="border border-stone-100 rounded-lg p-2 bg-stone-50">
                      <span className="block text-[8px] uppercase tracking-wider text-stone-400 font-bold mb-1">Presets Rápidos (Toque para aplicar):</span>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {imagePresets.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPromoForm({ ...promoForm, image: preset.url })}
                            className={`aspect-square rounded-md overflow-hidden relative border hover:border-brand-gold transition-colors ${
                              promoForm.image === preset.url ? "border-brand-gold border-2 ring-1 ring-brand-gold" : "border-stone-200"
                            }`}
                            title={preset.name}
                          >
                            <img src={preset.url || undefined} alt={preset.name} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPromoModalOpen(false)}
                      className="px-4 py-2 bg-stone-100 text-stone-700 font-semibold text-xs rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-brand-navy hover:bg-brand-navy-light text-white font-bold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4 text-brand-gold" />
                      Salvar Promoção
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================
            MODAL FORM: CATEGORY ADD & EDIT
            ======================================================== */}
        <AnimatePresence>
          {isCategoryModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-navy/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
              >
                <div className="bg-brand-navy text-white px-6 py-4 flex items-center justify-between border-b border-brand-gold/30">
                  <h3 className="font-serif text-lg font-bold">
                    {editingCategory ? "Editar Categoria" : "Nova Categoria"} ({categoryType === "main" ? "Principal" : "Bebidas"})
                  </h3>
                  <button onClick={() => setIsCategoryModalOpen(false)} className="text-stone-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Identificador Único (id)*</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingCategory}
                      value={categoryForm.id || ""}
                      onChange={(e) => {
                        const sanitized = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, "-");
                        setCategoryForm({ ...categoryForm, id: sanitized });
                      }}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono disabled:opacity-50"
                      placeholder="Ex: carnes-especiais"
                    />
                    {!editingCategory && (
                      <span className="text-[9px] text-stone-400 block mt-1 leading-none">Letras minúsculas e hífens apenas. Não editável após criado.</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Nome de Exibição*</label>
                    <input
                      type="text"
                      required
                      value={categoryForm.name || ""}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                      placeholder="Ex: Carnes Especiais"
                    />
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(false)}
                      className="px-4 py-2 bg-stone-100 text-stone-700 font-semibold text-xs rounded-lg uppercase transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-brand-navy hover:bg-brand-navy-light text-white font-bold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1 transition-colors"
                    >
                      <Save className="w-4 h-4 text-brand-gold" /> Salvar
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================
            MODAL FORM: GALLERY ADD & EDIT
            ======================================================== */}
        <AnimatePresence>
          {isGalleryModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-navy/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
              >
                <div className="bg-brand-navy text-white px-6 py-4 flex items-center justify-between border-b border-brand-gold/30">
                  <h3 className="font-serif text-lg font-bold">
                    {editingGallery ? "Editar Imagem Galeria" : "Nova Imagem Galeria"}
                  </h3>
                  <button onClick={() => setIsGalleryModalOpen(false)} className="text-stone-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveGallery} className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Título de Legenda*</label>
                    <input
                      type="text"
                      required
                      value={galleryForm.title || ""}
                      onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                      placeholder="Ex: Nosso Espaço Climatizado"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Foto da Galeria*</label>
                    <div className="space-y-2">
                      <div className="relative border-2 border-dashed border-stone-200 hover:border-brand-gold/60 rounded-xl p-3 bg-stone-50/50 hover:bg-stone-50 transition-colors flex flex-col items-center justify-center cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, (base64) => setGalleryForm({ ...galleryForm, image: base64 }), 1000, 0.90)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          id="gallery-image-upload"
                        />
                        <Upload className="w-5 h-5 text-stone-400 mb-1" />
                        <span className="text-[11px] font-medium text-stone-600">Enviar foto direto do celular/computador</span>
                        <span className="text-[9px] text-stone-400">Arraste ou toque para selecionar a foto</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          required
                          value={galleryForm.image || ""}
                          onChange={(e) => setGalleryForm({ ...galleryForm, image: e.target.value })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                          placeholder="Ou cole o link (URL) da foto"
                        />
                        {galleryForm.image && (
                          <div className="w-10 h-10 rounded-lg border border-stone-200 overflow-hidden shrink-0 bg-stone-100">
                            <img src={galleryForm.image || undefined} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsGalleryModalOpen(false)}
                      className="px-4 py-2 bg-stone-100 text-stone-700 font-semibold text-xs rounded-lg uppercase transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-brand-navy hover:bg-brand-navy-light text-white font-bold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1 transition-colors"
                    >
                      <Save className="w-4 h-4 text-brand-gold" /> Gravar Imagem
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ==========================================
  // RENDER: THE PRISTINE CUSTOMER DIGIMENU VIEW
  // ==========================================
  return (
    <div className="min-h-screen bg-stone-50 font-sans text-brand-navy antialiased">
      {/* HEADER HERO BANNER & COVER */}
      <header className="relative w-full overflow-hidden bg-brand-navy" id="hero-banner">
        <div className="absolute inset-0 z-0">
          <img
            src={menuData.restaurantInfo.coverImage || undefined}
            alt={menuData.restaurantInfo.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-35 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/90 via-brand-navy/70 to-brand-navy" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-brand-gold/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-12 pb-16 text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-8 hover:scale-102 transition-transform duration-350 ease-out will-change-transform"
          >
            <DomEduardoLogo className="w-44 h-44 md:w-52 md:h-52" light={true} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-4 inline-flex items-center gap-2 px-4 py-1 border border-brand-gold/30 bg-brand-gold/5 rounded-full"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
            <span className="font-sans text-[11px] font-semibold text-brand-gold uppercase tracking-[0.2em]">
              Gastronomia Premium
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-2xl"
          >
            <h1 className="font-serif text-3xl md:text-4xl font-semibold text-white tracking-tight mb-4 leading-snug">
              {menuData.restaurantInfo.tagline}
            </h1>
            <p className="font-sans text-stone-300 text-sm md:text-base leading-relaxed font-light">
              {renderWithBold(menuData.restaurantInfo.aboutText)}
            </p>
          </motion.div>
        </div>
      </header>

      {/* PAYMENT / COUVERT BAR */}
      <section className="bg-brand-navy border-y-2 border-brand-gold/40 relative z-10" id="info-ribbon">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-brand-gold rounded-full" />
            <span className="font-serif italic text-white text-sm md:text-base">
              Aceitamos {menuData.restaurantInfo.paymentInfo.methods.join(" • ")}
            </span>
          </div>
          <div className="w-12 h-[1px] bg-brand-gold/30 sm:hidden" />
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-brand-gold" />
            <span className="font-serif italic text-brand-gold text-sm md:text-base">
              {menuData.restaurantInfo.paymentInfo.couvertText}
            </span>
            <div className="w-1.5 h-1.5 bg-brand-gold rounded-full" />
          </div>
        </div>
      </section>

      {/* LIVE INTERACTIVE CUSTOMER CARDAPIO CONTAINER */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-10" id="cardapio-digital">
        
        {/* BIG SEARCH BAR */}
        <div className="mb-8 max-w-md mx-auto" id="search-section">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-400 group-focus-within:text-brand-gold transition-colors duration-200">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Pesquisar prato no cardápio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200/80 rounded-full text-sm font-sans placeholder-stone-400 text-brand-navy shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-stone-400 hover:text-brand-navy transition-colors duration-200"
                aria-label="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* PROMOÇÃO DO DIA SECTION (CONDITIONAL RENDERING) */}
        {searchQuery.trim() === "" && (menuData.promotions || []).some(p => !p.isArchived) && (
          <div className="mb-12 max-w-2xl mx-auto" id="daily-promotions-section">
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className="h-[1px] w-6 bg-brand-gold/30" />
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-brand-gold animate-pulse" />
                <h3 className="font-sans text-[11px] font-bold text-brand-navy uppercase tracking-[0.25em]">Promoção do Dia</h3>
              </div>
              <div className="h-[1px] w-6 bg-brand-gold/30" />
            </div>

            <div className="space-y-5">
              {(menuData.promotions || [])
                .filter((p) => !p.isArchived)
                .map((promo) => (
                  <motion.div
                    key={promo.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="overflow-hidden rounded-2xl border border-brand-gold/20 bg-brand-navy p-4 flex flex-col sm:flex-row gap-5 items-center relative text-white shadow-lg"
                  >
                    <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent" />
                    
                    {promo.image && (
                      <div className="w-full sm:w-28 sm:h-28 aspect-video sm:aspect-square rounded-xl overflow-hidden bg-brand-navy-light relative flex-shrink-0 border border-white/5 shadow-md">
                        <img
                          src={promo.image}
                          alt={promo.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1 text-center sm:text-left space-y-1.5 py-0.5">
                      <h4 className="font-serif text-base font-bold text-brand-gold leading-tight">
                        {promo.title}
                      </h4>
                      <p className="font-sans text-xs text-stone-300 leading-relaxed font-light">
                        {promo.description}
                      </p>
                      {promo.price && (
                        <div className="inline-block mt-0.5 font-sans text-[10px] font-semibold text-brand-gold border border-brand-gold/20 bg-brand-gold/5 px-2 py-0.5 rounded tracking-wide">
                          {promo.price}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        )}

        {/* STICKY NAV CATEGORIES */}
        {searchQuery.trim() === "" && (
          <nav className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-stone-50/90 backdrop-blur-md border-b border-stone-200/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-8 overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1.5 md:justify-center">
            {renderedCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`px-4 py-2 rounded-full font-sans text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
                  activeCategory === cat.id
                    ? "bg-brand-navy text-brand-gold border border-brand-gold/40 shadow-sm"
                    : "bg-white text-stone-600 hover:text-brand-navy hover:bg-stone-100 border border-stone-200/60"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        )}

        {/* RENDER CATEGORY SEGMENTS */}
        <section id="menu-lists" className="space-y-16">
          {renderedCategories.map((category) => {
            if (!hasItemsInSearch(category.id)) return null;

            const isSearchActive = searchQuery.trim() !== "";
            const displayItems = category.id === "destaques"
              ? filteredItems.filter((item) => item.isHighlight && item.categoryId === "baguetes")
              : filteredItems.filter((item) => item.categoryId === category.id);

            if (displayItems.length === 0) return null;

            return (
              <div
                key={category.id}
                id={category.id}
                ref={(el) => {
                  menuSectionsRef.current[category.id] = el;
                }}
                className="scroll-mt-32"
              >
                {/* Visual Section Divider */}
                {category.id !== "destaques" && (
                  <div className="flex flex-col items-center justify-center text-center mb-8 relative">
                    <div className="w-10 h-[1.5px] bg-brand-gold mb-2" />
                    <h2 className="font-serif text-2xl md:text-3xl font-bold text-brand-navy tracking-tight uppercase">
                      {category.name}
                    </h2>
                    <div className="absolute -bottom-2 w-2 h-2 rotate-45 border-r border-b border-brand-gold/60" />
                  </div>
                )}

                {/* Specific layouts based on category type */}
                {category.id === "destaques" ? (
                  /* Custom Vintage Paper-Menu Layout with Columns, Dotted Leaders, and Photos */
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white border-2 border-brand-navy p-6 md:p-10 rounded-2xl relative shadow-md">
                      {/* Inner thin frame */}
                      <div className="border border-brand-gold/40 p-5 md:p-8 rounded-xl">
                        {/* Decorative centered header */}
                        <div className="text-center mb-8">
                          <h3 className="font-serif text-xl md:text-2xl font-bold uppercase tracking-[0.15em] text-brand-navy mb-1">
                            Destaques da Casa
                          </h3>
                          <span className="font-serif italic text-sm text-brand-gold tracking-[0.2em] uppercase block font-medium">
                            Baguetes
                          </span>
                          <div className="w-16 h-[1.5px] bg-brand-gold mx-auto mt-2.5" />
                        </div>

                        {/* List grid with columns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                          {displayItems.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => setSelectedZoomItem(item)}
                              className="group flex gap-4 cursor-zoom-in hover:bg-stone-50/60 p-2.5 rounded-xl transition-all duration-300"
                            >
                              {/* The item image */}
                              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden shrink-0 bg-stone-100 shadow-xs border border-stone-200/50">
                                <img
                                  src={item.image || undefined}
                                  alt={item.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                {item.isOutOfStock && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-white px-1.5 py-0.5 rounded bg-red-600/90">
                                      Esgotado
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Item details */}
                              <div className="flex-1 flex flex-col justify-between py-0.5">
                                <div>
                                  <div className="flex items-baseline gap-1">
                                    <span className="font-serif font-bold text-brand-navy text-sm md:text-base group-hover:text-brand-gold transition-colors duration-200">
                                      {item.name}
                                    </span>
                                    <div className="flex-1 border-b border-dotted border-stone-300 min-w-4 mx-1" />
                                    <span className="font-sans font-bold text-brand-gold text-sm md:text-base shrink-0">
                                      {formatPrice(item.price)}
                                    </span>
                                  </div>
                                  {item.description && (
                                    <p className="font-sans text-stone-500 text-xs md:text-sm font-light mt-1.5 leading-relaxed line-clamp-2 md:line-clamp-3">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                  <span className="text-[10px] text-brand-gold font-semibold uppercase tracking-wider group-hover:underline">
                                    Ampliar Foto
                                  </span>
                                  {!item.isOutOfStock && (
                                    <span className="text-[9px] text-stone-400 font-sans uppercase tracking-widest">
                                      Destaque da Casa
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : category.id === "bebidas" ? (
                  /* Accordion-style subcategories (sucos naturais, águas, cervejas...) for Beverages */
                  <div className="max-w-4xl mx-auto space-y-4" id="beverages-accordion-group">
                    {menuData.beverageSubcategories.map((sub) => {
                      const subItems = displayItems.filter((item) => item.subcategoryId === sub.id);
                      if (subItems.length === 0) return null;

                      const isOpen = openBeverageSubs[sub.id] || isSearchActive;

                      return (
                        <div
                          key={sub.id}
                          className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
                        >
                          <button
                            onClick={() => toggleBeverageSub(sub.id)}
                            className="w-full flex items-center justify-between p-5 text-left focus:outline-none hover:bg-stone-50/50 transition-colors duration-200"
                          >
                            <span className="font-serif text-base font-semibold text-brand-navy flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
                              {sub.name}
                            </span>
                            <span className="p-1 rounded-full bg-stone-100 text-stone-500">
                              <motion.div
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </motion.div>
                            </span>
                          </button>

                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.35, ease: "easeInOut" }}
                              >
                                <div className="p-5 border-t border-stone-100 bg-stone-50/30">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {subItems.map((beverage) => (
                                      <div
                                        key={beverage.id}
                                        className="flex gap-4 p-4 bg-white rounded-lg border border-stone-200/60 shadow-xs hover:border-brand-gold/35 transition-all duration-300 group"
                                      >
                                        <div
                                          onClick={() => setSelectedZoomItem(beverage)}
                                          className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-stone-100 cursor-zoom-in shadow-xs"
                                        >
                                          <img
                                            src={beverage.image || undefined}
                                            alt={beverage.name}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                          />
                                          {beverage.isOutOfStock && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                              <span className="text-[9px] font-bold uppercase tracking-wider text-white px-1.5 py-0.5 rounded bg-red-600/90">
                                                Esgotado
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between py-0.5">
                                          <div>
                                            <div className="flex justify-between items-start gap-2 mb-1">
                                              <h4 className="font-sans text-sm font-semibold text-brand-navy">{beverage.name}</h4>
                                              <span className="font-sans text-sm font-bold text-brand-gold whitespace-nowrap">
                                                {formatPrice(beverage.price)}
                                              </span>
                                            </div>
                                            <p className="font-sans text-stone-500 text-[11px] leading-relaxed line-clamp-2">
                                              {beverage.description}
                                            </p>
                                          </div>
                                          <div className="flex justify-between items-center mt-2">
                                            <button
                                              onClick={() => setSelectedZoomItem(beverage)}
                                              className="text-[10px] text-brand-gold text-left uppercase tracking-wider hover:text-brand-gold-dark transition-colors"
                                            >
                                              Ampliar Foto
                                            </button>
                                            {beverage.isOutOfStock && (
                                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">
                                                Esgotado
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Standard Card Layout Grid for other foods */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {displayItems.map((item) => (
                      <MenuItemCard key={item.id} item={item} onZoom={setSelectedZoomItem} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 max-w-md mx-auto" id="search-empty-state">
              <UtensilsCrossed className="w-8 h-8 text-stone-300 mx-auto mb-3" />
              <p className="font-serif text-lg font-medium text-brand-navy mb-1">Nenhum prato encontrado</p>
              <p className="font-sans text-sm text-stone-500">Tente reescrever a pesquisa ou limpe o filtro.</p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 px-4 py-2 bg-brand-navy text-white hover:bg-brand-navy-light text-xs font-semibold uppercase tracking-wider rounded-full transition-colors duration-200"
              >
                Limpar Busca
              </button>
            </div>
          )}
        </section>

        {/* GALLERIES */}
        <section className="mt-20 scroll-mt-24" id="galeria">
          <div className="flex flex-col items-center justify-center text-center mb-10">
            <div className="w-10 h-[1.5px] bg-brand-gold mb-2" />
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-brand-navy tracking-tight uppercase">
              Gastronomia & Ambiente
            </h2>
            <p className="font-sans text-xs text-stone-500 mt-1 max-w-md">
              Pratos autorais e um espaço aconchegante desenhados para acolher os paladares mais exigentes.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {menuData.galleryItems.slice(0, 4).map((gal) => (
              <div
                key={gal.id}
                onClick={() =>
                  setSelectedZoomItem({
                    id: gal.id,
                    categoryId: "gallery",
                    name: gal.title,
                    description: "Registro real do Dom Eduardo Restobar.",
                    price: "A Consultar",
                    image: gal.image,
                  })
                }
                className="group relative aspect-square overflow-hidden bg-stone-100 rounded-xl border border-stone-200/50 cursor-zoom-in shadow-xs"
              >
                <img src={gal.image || undefined} alt={gal.title} referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/80 via-brand-navy/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4" />
                <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 text-white">
                  <p className="font-serif text-xs font-semibold text-brand-gold tracking-wide leading-snug">{gal.title}</p>
                  <span className="font-sans text-[9px] text-stone-300 tracking-wider uppercase block mt-0.5">Toque para Ampliar</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-brand-navy text-white mt-24 border-t-2 border-brand-gold/30" id="contato">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left mb-12">
            <div className="flex flex-col items-center md:items-start">
              <div className="mb-4">
                <DomEduardoLogo className="w-32 h-32" light={true} />
              </div>
              <p className="font-sans text-stone-300 text-xs leading-relaxed max-w-xs font-light">
                Tradição culinária. Unindo gastronomia premium e momentos inesquecíveis em Natal.
              </p>
            </div>

            <div className="flex flex-col items-center md:items-start justify-center">
              <h4 className="font-serif text-lg font-semibold text-brand-gold mb-4 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-brand-gold" />
                Funcionamento
              </h4>
              <ul className="space-y-2 text-stone-300 text-xs font-sans font-light">
                {menuData.restaurantInfo.contact.hours.map((h, i) => (
                  <li key={i} className="flex justify-between w-64 gap-4">
                    <span className="font-medium text-stone-200">{h.days}:</span>
                    <span>{h.time}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col items-center md:items-start justify-center">
              <h4 className="font-serif text-lg font-semibold text-brand-gold mb-4 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4.5 h-4.5 text-brand-gold" />
                Localização
              </h4>
              <p className="font-sans text-stone-300 text-xs font-light leading-relaxed mb-4 max-w-xs">
                {menuData.restaurantInfo.contact.address}
              </p>
              <a
                href={menuData.restaurantInfo.contact.addressMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-brand-gold/30 hover:border-brand-gold/80 bg-brand-navy-light rounded-lg text-xs font-semibold tracking-wider text-brand-gold transition-all duration-200"
              >
                <span>Ver no Google Maps</span>
              </a>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-6" id="social-contact-panel">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <span className="font-sans text-xs text-stone-400 font-light">
                Dúvidas ou quer falar conosco?
              </span>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={menuData.restaurantInfo.contact.whatsappUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/25 border border-[#25D366]/30 hover:border-[#25D366] text-white text-xs font-semibold rounded-md transition-all duration-200"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`tel:${menuData.restaurantInfo.contact.phone.replace(/[^0-9]/g, "")}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-gold/10 hover:bg-brand-gold/25 border border-brand-gold/30 hover:border-brand-gold text-white text-xs font-semibold rounded-md transition-all duration-200"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Ligar</span>
                </a>
              </div>
            </div>

            <a
              href={menuData.restaurantInfo.contact.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-stone-300 hover:text-brand-gold transition-colors duration-200"
            >
              <Instagram className="w-5 h-5 text-brand-gold group-hover:scale-105 transition-transform" />
              <span className="font-sans text-xs font-medium">{menuData.restaurantInfo.contact.instagram}</span>
            </a>
          </div>

          {/* Footer copyright */}
          <div className="border-t border-white/5 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-center text-[10px] text-stone-500 font-sans tracking-wider uppercase">
            <span>© {new Date().getFullYear()} {menuData.restaurantInfo.name}. Todos os direitos reservados.</span>
            <span className="hidden sm:inline text-white/20">|</span>
            <button
              onClick={enterAdminMode}
              className="flex items-center gap-1 text-stone-400 hover:text-brand-gold transition-colors duration-200 cursor-pointer"
            >
              <Lock className="w-3 h-3 text-brand-gold/70" />
              <span>Acesso Administrativo</span>
            </button>
          </div>
        </div>
      </footer>

      {/* DETAIL LIGHTBOX */}
      <ZoomModal
        isOpen={selectedZoomItem !== null}
        onClose={() => setSelectedZoomItem(null)}
        image={activeZoomedItem?.image || ""}
        name={activeZoomedItem?.name || ""}
        description={activeZoomedItem?.description || ""}
        price={activeZoomedItem?.categoryId === "gallery" ? undefined : activeZoomedItem?.price}
        isOutOfStock={activeZoomedItem?.isOutOfStock}
      />

      {/* SCROLL TO TOP */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-brand-navy hover:bg-brand-navy-accent text-brand-gold border border-brand-gold/40 shadow-xl cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200"
            aria-label="Voltar ao topo"
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
