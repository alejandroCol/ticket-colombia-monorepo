import MainLayout from "./pages/main";
import { ContactConfigProvider } from "./contexts/ContactConfigContext";

function App() {
  return (
    <ContactConfigProvider>
      <MainLayout />
    </ContactConfigProvider>
  );
}

export default App;
