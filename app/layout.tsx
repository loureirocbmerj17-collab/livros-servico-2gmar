import type { Metadata } from 'next';
export const metadata:Metadata={title:'Livros de Serviço | 2º GMAR',description:'Livros de serviço do 2º Grupamento Marítimo — Barra da Tijuca.',icons:{icon:'/timao-unidade.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
