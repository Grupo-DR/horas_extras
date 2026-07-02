import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, HardHat, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const ConstructionSelectionView: React.FC = () => {
  const navigate = useNavigate();
  const { hasModuleAccess } = useAuth();

  const hasVli = hasModuleAccess('construction_vli');
  const hasRdo = hasModuleAccess('construction_rdo');

  React.useEffect(() => {
    if (!hasVli && !hasRdo) {
      navigate('/');
    } else if (hasVli && !hasRdo) {
      navigate('/construction');
    } else if (!hasVli && hasRdo) {
      navigate('/rdo');
    }
  }, [hasVli, hasRdo, navigate]);

  if (!hasVli || !hasRdo) return null; // Prevent flicker while redirecting

  return (
    <div className="flex h-screen bg-slate-50 flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">Módulos de Obras</h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">
          Selecione o módulo de gestão de obras que deseja acessar. Cada módulo atende a necessidades específicas do projeto.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
        
        {/* Vias de Acesso VLI */}
        {hasVli && (
        <div 
          onClick={() => navigate('/construction')}
          className="group cursor-pointer bg-white rounded-3xl p-8 border border-slate-200 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 flex flex-col h-full"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <Building2 className="w-8 h-8 text-amber-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Gestão de Obras</h2>
          <h3 className="text-md font-semibold text-amber-600 mb-4">Vias de Acesso VLI</h3>
          
          <p className="text-slate-500 mb-8 flex-1 leading-relaxed">
            Módulo focado no acompanhamento, produção nos canteiros e eficiência de projetos específicos de infraestrutura.
          </p>
          
          <div className="flex items-center text-amber-600 font-semibold group-hover:text-amber-700">
            <span>Acessar Módulo</span>
            <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
          </div>
        </div>
        )}

        {/* RDO Online */}
        {hasRdo && (
        <div 
          onClick={() => navigate('/rdo')}
          className="group cursor-pointer bg-white rounded-3xl p-8 border border-slate-200 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 flex flex-col h-full relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-0 opacity-50 group-hover:scale-125 transition-transform duration-500"></div>
          
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 relative z-10">
            <HardHat className="w-8 h-8 text-blue-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-3 relative z-10">Gestão de Obras</h2>
          <h3 className="text-md font-semibold text-blue-600 mb-4 relative z-10">RDO Online (Analytics)</h3>
          
          <p className="text-slate-500 mb-8 flex-1 leading-relaxed relative z-10">
            Módulo voltado para obras que possuem RDO online. Permite exportação de PDFs e integração com inteligência artificial para analytics.
          </p>
          
          <div className="flex items-center text-blue-600 font-semibold group-hover:text-blue-700 relative z-10">
            <span>Acessar Módulo</span>
            <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
          </div>
        </div>
        )}

      </div>
      
      <button 
        onClick={() => navigate('/')}
        className="mt-12 text-slate-500 hover:text-slate-800 font-medium flex items-center transition-colors"
      >
        <ChevronRight className="w-5 h-5 mr-1 rotate-180" />
        Voltar para o Centro de Inteligência
      </button>
    </div>
  );
};
