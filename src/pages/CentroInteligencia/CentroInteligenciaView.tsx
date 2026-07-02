/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleDollarSign, Users, FileText, ChevronLeft, ChevronRight, Building2, TrendingUp, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { canManageProfiles } from '../../modules/iam/types';

// Carrega dinamicamente todas as imagens da pasta assets/carousel (no momento do build)
const slideImages = import.meta.glob('../../../assets/carousel/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' });
const imagePaths = Object.values(slideImages) as string[];

type SlideType = {
  id: number;
  bgColor: string;
  bgImage?: string;
  title: string;
  description: string;
  align: string;
};

const DEFAULT_SLIDES: SlideType[] = [
  {
    id: 1,
    bgColor: 'bg-slate-900',
    title: 'Centro de Inteligência',
    description: 'Um Portal com Informações para Construirmos o Progresso com Segurança, Agilidade e Eficiência.',
    align: 'items-start text-left',
  },
  {
    id: 2,
    bgColor: 'bg-blue-900',
    title: 'Dados Atualizados Diariamente',
    description: 'Tome decisões baseadas em números e garanta a eficiência das obras.',
    align: 'items-center text-center',
  },
  {
    id: 3,
    bgColor: 'bg-slate-900',
    title: 'Visão 360º dos Projetos',
    description: 'Acompanhe financeiro, suprimentos e engenharia em um só lugar.',
    align: 'items-end text-right',
  },
];

// Se tivermos imagens na pasta, criamos slides baseados nelas, aproveitando os textos (como overlay).
// Se não houver, voltamos para o modo padrão de cores sólidas.
const SLIDES = imagePaths.length > 0 
  ? imagePaths.map((path, index) => {
      const defaultSlide = DEFAULT_SLIDES[index % DEFAULT_SLIDES.length];
      return {
        ...defaultSlide,
        id: index + 1,
        bgImage: path
      };
    })
  : DEFAULT_SLIDES;

export const CentroInteligenciaView: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, profile } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-play carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === SLIDES.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev === SLIDES.length - 1 ? 0 : prev + 1));
  const prevSlide = () => setCurrentSlide((prev) => (prev === 0 ? SLIDES.length - 1 : prev - 1));

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="flex flex-col min-h-full bg-white overflow-x-hidden">
      {/* User Widget */}
      <div className="fixed bottom-6 left-6 z-50">
        <div className="flex items-center p-2 pr-4 rounded-xl bg-white shadow-xl border border-slate-200 hover:border-slate-300 transition-all duration-300 gap-3">
          <div className="shrink-0 relative">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold border border-blue-700 shadow-sm">
                {user?.name ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() : 'US'}
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-700 truncate block">
              {user?.name || 'Usuário'}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate block">
              {user?.role || 'Membro'}
            </span>
          </div>
          <div className="ml-2 pl-3 border-l border-slate-100">
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Sair"
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Carousel Section */}
      <div className="relative h-[30vh] min-h-[250px] w-full overflow-hidden shadow-2xl">
        {SLIDES.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
            } ${slide.bgImage ? 'bg-black' : slide.bgColor}`}
          >
            {slide.bgImage && (
                <img 
                  src={slide.bgImage} 
                  className="absolute inset-0 w-full h-full object-cover opacity-50" 
                  alt={`Slide ${index + 1}`} 
                />
            )}
            <div className="container relative mx-auto h-full px-6 flex flex-col justify-center z-10">
              <div className={`flex flex-col w-full ${slide.align} text-white space-y-4`}>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight animate-in slide-in-from-bottom-5 duration-700 drop-shadow-md">
                  {slide.title}
                </h1>
                <p className="text-lg md:text-xl text-blue-100/90 max-w-2xl font-medium animate-in slide-in-from-bottom-8 duration-700 delay-150 drop-shadow">
                  {slide.description}
                </p>
                {index === 0 && (
                  <button 
                    onClick={() => document.getElementById('areas')?.scrollIntoView({ behavior: 'smooth' })}
                    className="mt-6 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold transition-all transform hover:scale-105 shadow-lg animate-in fade-in duration-1000 delay-300"
                  >
                    Escolher Área
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Controls */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm transition-all"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm transition-all"
        >
          <ChevronRight className="w-8 h-8" />
        </button>

        {/* Carousel Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Areas Section */}
      <div id="areas" className="container mx-auto px-6 py-12 flex-grow">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          
          {/* Financeiro */}
          <div 
            onClick={() => handleNavigation('/powerbi-viewer?area=Financeiro')}
            className="group cursor-pointer flex flex-col items-center text-center space-y-4 p-4 rounded-2xl transition-all duration-300 hover:bg-blue-50/50"
          >
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center transform transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-blue-200">
              <CircleDollarSign className="w-10 h-10 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Financeiro</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Acesso a relatórios financeiros para apoiar gestores em decisões estratégicas.
              </p>
            </div>
          </div>

          {/* Capital Humano */}
          <div 
            onClick={() => handleNavigation('/human-capital')}
            className="group cursor-pointer flex flex-col items-center text-center space-y-4 p-4 rounded-2xl transition-all duration-300 hover:bg-green-50/50"
          >
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center transform transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-green-200">
              <Users className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Capital Humano</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Acesso à gestão de pessoas, horas extras, essencial para a saúde da empresa.
              </p>
            </div>
          </div>

          {/* Gestão de Contratos */}
          <div 
            onClick={() => handleNavigation('/powerbi-viewer?area=Gestão de Contratos')}
            className="group cursor-pointer flex flex-col items-center text-center space-y-4 p-4 rounded-2xl transition-all duration-300 hover:bg-indigo-50/50"
          >
            <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center transform transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-indigo-200">
              <FileText className="w-10 h-10 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Gestão de Contratos</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Gestão contratual de obras para garantir saúde financeira e cumprimento de prazos.
              </p>
            </div>
          </div>

          {/* Comercial */}
          <div 
            onClick={() => handleNavigation('/commercial')}
            className="group cursor-pointer flex flex-col items-center text-center space-y-4 p-4 rounded-2xl transition-all duration-300 hover:bg-orange-50/50"
          >
            <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center transform transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-orange-200">
              <TrendingUp className="w-10 h-10 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Comercial</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Gestão de prospecções, orçamentos, inteligência comercial e CRM de clientes.
              </p>
            </div>
          </div>

          {/* Obras */}
          <div 
            onClick={() => handleNavigation('/construction-selection')}
            className="group cursor-pointer flex flex-col items-center text-center space-y-4 p-4 rounded-2xl transition-all duration-300 hover:bg-amber-50/50"
          >
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center transform transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-amber-200">
              <Building2 className="w-10 h-10 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Obras</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Acompanhamento, produção nos canteiros de obra e eficiência de projetos.
              </p>
            </div>
          </div>

          {/* Gestão de Acessos (IAM) - Somente Master/Admin */}
          {canManageProfiles(profile) && (
            <div 
              onClick={() => handleNavigation('/admin/users')}
              className="group cursor-pointer flex flex-col items-center text-center space-y-4 p-4 rounded-2xl transition-all duration-300 hover:bg-red-50/50"
            >
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center transform transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-red-200">
                <Shield className="w-10 h-10 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">Painel Master (IAM)</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Gestão global de usuários, perfis de acesso e permissões de módulos.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
