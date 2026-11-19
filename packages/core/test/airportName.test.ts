import { describe, expect, it } from "vitest";
import { airportShortName } from "../src";

const CITIES = new Set(["milan", "lyon", "athens", "london", "paris", "new york"]);
const isCity = (w: string) => (CITIES.has(w.toLowerCase()) ? 5 : 0);
const n = (name: string, city: string) => airportShortName({ name, city }, isCity);

describe("airportShortName", () => {
  it("names airports as pilots say them", () => {
    expect(n("Charles de Gaulle International Airport", "Paris (Roissy-en-France, Val-d'Oise)")).toBe("Paris – Charles de Gaulle");
    expect(n("Paris-Le Bourget International Airport", "Paris")).toBe("Paris – Le Bourget");
    expect(n("Paris-Orly Airport", "Paris (Orly, Val-de-Marne)")).toBe("Paris – Orly");
    expect(n("Adolfo Suárez Madrid–Barajas Airport", "Madrid")).toBe("Madrid – Barajas");
    expect(n("Josep Tarradellas Barcelona-El Prat Airport", "Barcelona")).toBe("Barcelona – El Prat");
    expect(n("Milan Malpensa International Airport", "Ferno (VA)")).toBe("Milan – Malpensa");
    expect(n("Amsterdam Airport Schiphol", "Amsterdam")).toBe("Amsterdam – Schiphol");
    expect(n("London Heathrow Airport", "London")).toBe("London – Heathrow");
    expect(n("Geneva International Airport", "Geneva")).toBe("Geneva");
    expect(n("Nice-Côte d'Azur Airport", "Nice, Alpes-Maritimes")).toBe("Nice – Côte d'Azur");
    expect(n("Toulouse-Blagnac Airport", "Toulouse/Blagnac")).toBe("Toulouse – Blagnac");
    expect(n("Toussus-le-Noble Airport", "Toussus-le-Noble, Yvelines")).toBe("Toussus-le-Noble");
    expect(n("Lyon Saint-Exupéry Airport", "Colombier-Saugnieu, Rhône")).toBe("Lyon – Saint-Exupéry");
    expect(n("John F. Kennedy International Airport", "New York")).toBe("New York – John F. Kennedy");
    expect(n("Dublin Airport", "Dublin")).toBe("Dublin");
    expect(n("Melun-Villaroche Airfield", "Moissy-Cramayel, Seine-et-Marne")).toBe("Melun – Villaroche");
    expect(n("Pontoise-Cormeilles Aerodrome", "Cormeilles-en-Vexin, Val-d'Oise")).toBe("Pontoise – Cormeilles");
    expect(n("Beauvais-Tillé airport", "Beauvais")).toBe("Beauvais – Tillé");
    expect(n("Vitoria Airport", "Alava")).toBe("Vitoria");
    expect(n("Saint-Yan Airport", "L'Hôpital-le-Mercier, Saône-et-Loire")).toBe("Saint-Yan");
    expect(n("Valence-Chabeuil Airport", "Chabeuil, Drôme")).toBe("Valence – Chabeuil");
    expect(n("Péronne Saint-Quentin Airfield", "Monchy-Lagache, Somme")).toBe("Péronne Saint-Quentin");
    expect(n("Aérodrome de Saint-Girons - Antichan", "Saint-Girons/Antichan")).toBe("Saint-Girons – Antichan");
    expect(n("Biarritz Pays Basque airport", "Biarritz")).toBe("Biarritz – Pays Basque");
    expect(n("Cambridge City Airport", "Cambridge, Cambridgeshire")).toBe("Cambridge City");
    expect(n("Athens Eleftherios Venizelos International Airport", "Spata-Artemida")).toBe("Athens – Eleftherios Venizelos");
  });
});
