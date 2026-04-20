document.addEventListener("DOMContentLoaded", function() {
    // 1. Encontrar la ruta de la carpeta raíz basándonos en este script
    const scriptTag = document.querySelector('script[src*="main.js"]');
    const scriptPath = scriptTag.getAttribute('src');
    const rootPath = scriptPath.replace('main.js', '');

    // 2. Función para limpiar y arreglar el HTML inyectado
    const fixLinks = (html, base) => {
        let div = document.createElement('div');
        div.innerHTML = html;
        
        div.querySelectorAll('a[href^="/"]').forEach(link => {
            const actualPage = link.getAttribute('href').substring(1);
            link.setAttribute('href', base + actualPage);
        });

        div.querySelectorAll('img[src^="/"]').forEach(img => {
            const actualSrc = img.getAttribute('src').substring(1);
            img.setAttribute('src', base + actualSrc);
        });

        return div.innerHTML;
    };

    // 3. Cargar Navbar
    fetch(rootPath + 'navbar.html')
    .then(response => response.text())
    .then(data => {
        const headerEl = document.querySelector('header');
        headerEl.innerHTML = fixLinks(data, rootPath);
        
        // Agregamos clase para que CSS se aplique con fuerza
        headerEl.classList.add('loaded');
    })
    .catch(err => console.error("Error en Navbar:", err));

    // 4. Cargar Footer
    fetch(rootPath + 'footer.html')
        .then(response => response.text())
        .then(data => {
            document.querySelector('footer').innerHTML = fixLinks(data, rootPath);
        })
        .catch(err => console.error("Error en Footer:", err));

    // 5. Iconos Bootstrap
    if (!document.getElementById('bootstrap-icons')) {
        const link = document.createElement('link');
        link.id = 'bootstrap-icons';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
        document.head.appendChild(link);
    }

    // ========== SCROLL ANIMATIONS ==========
    
    // Intersection Observer para animaciones en scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = `fadeInUp 0.8s ease-out forwards`;
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observar elementos con clase "scroll-reveal"
    document.querySelectorAll('.scroll-reveal').forEach(el => {
        el.style.opacity = '0';
        observer.observe(el);
    });

    // ========== HEADER SCROLL EFFECT ==========
    
    let lastScrollTop = 0;
    const header = document.querySelector('header');

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Agregar sombra al scroll
        if (scrollTop > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }, false);

    // ========== PARALLAX EFFECT ==========
    
    const parallaxElements = document.querySelectorAll('.featured-image img, .featured-image video');
    
    window.addEventListener('scroll', () => {
        parallaxElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const scrollPos = window.pageYOffset;
            const elementOffset = element.offsetTop;
            
            // Parallax leve (3%)
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                const yPos = (scrollPos - elementOffset) * 0.03;
                element.style.transform = `translateY(${yPos}px)`;
            }
        });
    });

    // ========== STAGGER ANIMATIONS ==========
    
    // Para cards en grids
    const cards = document.querySelectorAll('.news-card, .article-card, .contact-card');
    cards.forEach((card, index) => {
        card.style.setProperty('--delay', `${0.1 * index}s`);
    });

    // ========== BUTTON RIPPLE EFFECT ==========
    
    const buttons = document.querySelectorAll('.read-more, .contact-card a');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const ripple = document.createElement('span');
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');

            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    });

    // ========== SMOOTH SCROLL FOR NAVIGATION ==========
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ========== PAGE LOAD COMPLETE ANIMATION ==========
    
    window.addEventListener('load', () => {
        document.body.style.opacity = '1';
    });

});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js")
      .then(reg => console.log("Service Worker registrado", reg))
      .catch(err => console.error("Error registrando Service Worker:", err));
  });
}
async function subscribeToPush() {
  try {
    if (!("serviceWorker" in navigator)) {
      alert("Este navegador no soporta service workers");
      return;
    }

    if (!("PushManager" in window)) {
      alert("Este navegador no soporta push notifications");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("No diste permiso para notificaciones");
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log("Ya existe suscripción:", existingSub);
      alert("Ya tienes alertas activadas");
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array("BL8V4LbPBOc8Wn4BNnu9Kj0eOOqsDYxlektrceADGZH-32HtrSN1uap-aVr-GH5IjwvvQBZ3RHTUZSw3GpgjcGE")
    });

    console.log("Suscripción creada:", subscription);

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(subscription)
    });

    const text = await res.text();
    console.log("Respuesta backend:", text);

    if (!res.ok) {
      throw new Error("El backend no guardó la suscripción");
    }

    const btn = document.getElementById("push-btn");
    if (btn) {
      btn.textContent = "✅ Alertas activadas";
      btn.disabled = true;
    }

    alert("Notificaciones activadas");
  } catch (err) {
    console.error("Error en push:", err);
    alert("Falló push: " + err.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("push-btn");
  if (!btn) {
    console.error("No existe #push-btn");
    return;
  }

  btn.addEventListener("click", subscribeToPush);
  console.log("Botón push conectado");
});
window.addEventListener('DOMContentLoaded', () => {
  const pushBtn = document.getElementById('push-btn');
  if (pushBtn) {
    pushBtn.addEventListener('click', subscribeToPush);
  }
});
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}