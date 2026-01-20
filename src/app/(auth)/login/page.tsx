"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth, useFirestore } from "@/firebase";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!auth || !db) {
        setError("Error de inicialización. Intente de nuevo.");
        setLoading(false);
        return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      
      const userDocRef = doc(db, "usuarios", uid);
      let userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // Special case: If it's the admin user and they don't have a profile, create one to unblock them.
        if (email.toLowerCase() === 'admin@crapro95.com') {
            const rolesQuery = query(collection(db, 'roles'), where('nombre', '==', 'admin'));
            const rolesSnapshot = await getDocs(rolesQuery);
            if (rolesSnapshot.empty) {
                 setError("El rol 'admin' no existe en la base de datos. No se puede crear el perfil de administrador.");
                 setLoading(false);
                 await auth.signOut();
                 return;
            }
            const adminRole = rolesSnapshot.docs[0];

            await setDoc(userDocRef, {
                nombre: 'Administrador',
                email: email,
                rolId: adminRole.id,
                rolNombre: 'admin',
                activo: true,
            });
            // Re-fetch the document after creating it
            userDoc = await getDoc(userDocRef);
        } else {
            setError("El usuario no tiene un perfil configurado en el sistema.");
            setLoading(false);
            await auth.signOut(); // Cerrar sesión si no tiene perfil
            return;
        }
      }
      
      // La redirección principal se maneja en el layout autenticado.
      // Aquí simplemente redirigimos al dashboard principal.
      router.push("/dashboard");

    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError("Correo electrónico o contraseña incorrectos.");
      } else if (err.code === 'auth/invalid-email') {
          setError("El formato del correo electrónico no es válido.");
      } else {
          setError("Ocurrió un error inesperado. Intente de nuevo.");
          console.error(err); // Log the full error for debugging
      }
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      setError("Por favor, ingrese su correo electrónico para recuperar la contraseña.");
      return;
    }
    setError("");
    setLoading(true);
    if (!auth) return;
    try {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
    } catch(err: any) {
        if (err.code === 'auth/user-not-found') {
             setError("No se encontró un usuario con ese correo electrónico.");
        } else {
            setError("No se pudo enviar el correo de recuperación. Intente más tarde.");
        }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F5EF] px-4">
      <div className="w-full max-w-sm bg-white p-6 md:p-8 rounded-2xl shadow-lg space-y-6">

        <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto">
              <Logo />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 font-headline">
              Bienvenido a CRApro95
            </h1>
             <p className="text-gray-500 text-sm">
                Control de Registro Agropecuario Profesional
             </p>
        </div>

        {!showReset ? (
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="tu@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="mt-1"
                    />
                </div>
                 <div>
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="mt-1"
                    />
                </div>

              {error && <p className="text-red-600 text-sm text-center pt-2">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-green-800 hover:bg-green-700 text-white py-3 rounded-lg font-semibold text-base"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Ingresar"}
              </Button>
            </form>
        ) : (
            <div className="space-y-4">
                 <div>
                    <Label htmlFor="reset-email">Correo para recuperación</Label>
                    <Input
                        id="reset-email"
                        type="email"
                        placeholder="tu@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="mt-1"
                    />
                </div>
                 {error && <p className="text-red-600 text-sm text-center pt-2">{error}</p>}
                 {resetSent && <p className="text-green-700 text-sm text-center pt-2">¡Correo enviado! Revisa tu bandeja de entrada.</p>}
                <Button
                    onClick={handleReset}
                    disabled={loading}
                    className="w-full bg-gray-600 hover:bg-gray-500 text-white py-3 rounded-lg font-semibold text-base"
                >
                    {loading ? <Loader2 className="animate-spin" /> : "Enviar correo de recuperación"}
                </Button>
            </div>
        )}

        <p
          onClick={() => {
            setShowReset(!showReset);
            setError("");
            setResetSent(false);
          }}
          className="text-center text-sm text-gray-600 hover:text-black underline cursor-pointer"
        >
          {showReset ? "Volver a iniciar sesión" : "Olvidé mi contraseña"}
        </p>

      </div>
    </div>
  );
}
