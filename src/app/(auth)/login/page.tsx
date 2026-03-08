"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { useAuth, useFirestore } from "@/firebase";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { buildEmpresaBasePayload, buildTenantRoleSeeds, tenantDoc } from "@/lib/tenant";
import { isPlatformAdminEmail } from "@/lib/platform-admins";

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

  const isAdminEmail = (value: string) => isPlatformAdminEmail(value);

  const ensureAdminEmpresa = async (uid: string, adminEmail: string) => {
    if (!db) return null;
    const empresaId = `empresa_${uid}`;
    const empresaRef = doc(db, "empresas", empresaId);
    const empresaSnap = await getDoc(empresaRef);

    if (!empresaSnap.exists()) {
      await setDoc(empresaRef, buildEmpresaBasePayload({
        nombre: "Empresa Demo",
        email: adminEmail,
        plan: "demo",
        maxUsuarios: 3,
      }), { merge: true });
    }

    const batch = writeBatch(db);
    buildTenantRoleSeeds().forEach((role) => {
      batch.set(tenantDoc(db, empresaId, "roles", role.id), {
        nombre: role.nombre,
        descripcion: role.descripcion,
        permisos: role.permisos,
        soloLectura: role.soloLectura,
        esSistema: role.esSistema,
      }, { merge: true });
    });
    batch.set(doc(db, "usuarios", uid), {
      empresaId,
      rolId: "admin",
      rolNombre: "admin",
      esSuperAdmin: true,
      activo: true,
      email: adminEmail.toLowerCase(),
    }, { merge: true });
    await batch.commit();
    return empresaId;
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!auth || !db) {
        setError("Error de inicialización. Intente de nuevo.");
        setLoading(false);
        return;
    }

    const isLoginAdmin = isAdminEmail(email);

    try {
      // Step 1: Attempt to sign in
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const userDocRef = doc(db, "usuarios", uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userProfile = userDoc.data();
        const updates: { activo?: boolean, rolId?: string, rolNombre?: string, esSuperAdmin?: boolean } = {};

        // If user is admin and inactive, activate them.
        if (isLoginAdmin && userProfile?.activo === false) {
            updates.activo = true;
        }

        // ALSO, if user is admin, ensure they have the admin role.
        if (isLoginAdmin && userProfile?.rolNombre !== 'admin') {
            updates.rolId = 'admin';
            updates.rolNombre = 'admin';
            updates.esSuperAdmin = true;
        }
        
        if (Object.keys(updates).length > 0) {
            await setDoc(userDocRef, updates, { merge: true });
        }
        if (isLoginAdmin && !userProfile?.empresaId) {
            await ensureAdminEmpresa(uid, email);
        }
      } else {
        // If user is authenticated but has no profile document...
        if (isLoginAdmin) {
            // ...and they are an admin, create a profile for them.
            const empresaId = await ensureAdminEmpresa(uid, email);
            await setDoc(userDocRef, {
                nombre: 'Administrador', email: email, rolId: 'admin', rolNombre: 'admin', activo: true, empresaId, esSuperAdmin: true,
            });
        } else {
            // A non-admin user without a profile is not allowed.
            await auth.signOut();
            throw new Error("El usuario no tiene un perfil configurado en el sistema.");
        }
      }
      
      router.push("/dashboard");

    } catch (error: any) {
        // Step 2: Handle sign-in failures
        if (error.code === 'auth/user-not-found' && isLoginAdmin) {
            // Admin doesn't exist in Auth, so let's create them.
            try {
                const newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
                const uid = newUserCredential.user.uid;
                const userDocRef = doc(db, "usuarios", uid);

                const empresaId = await ensureAdminEmpresa(uid, email);
                await setDoc(userDocRef, {
                    nombre: 'Administrador', email: email, rolId: 'admin', rolNombre: 'admin', activo: true, empresaId, esSuperAdmin: true,
                });
                
                router.push("/dashboard");

            } catch (creationError: any) {
                // This could happen if, for example, the password is too weak.
                setError("No se pudo crear la cuenta de administrador. " + creationError.message);
            }
        } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             if (isLoginAdmin) {
                setError("La contraseña del administrador es incorrecta. Use la opción 'Olvidé mi contraseña' para recuperarla.");
            } else {
                setError("Correo electrónico o contraseña incorrectos.");
            }
        } else {
            setError(error.message || "Ocurrió un error inesperado.");
            console.error(error);
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
                className="w-full bg-red-700 hover:bg-red-600 text-white py-3 rounded-lg font-semibold text-base"
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
    
