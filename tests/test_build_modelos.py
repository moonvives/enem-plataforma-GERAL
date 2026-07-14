import copy
import unittest
from collections import Counter, defaultdict

from scripts.build_modelos import (
    classify_tema,
    deduplicate_records,
    question_key,
    recognize_alternative,
    recover_gabarito,
)


def lookup():
    return {
        "by_item": defaultdict(Counter),
        "by_signature": defaultdict(Counter),
        "items_by_signature": defaultdict(set),
    }


class BuildModelosTest(unittest.TestCase):
    def test_biology_model_taxonomy_is_granular(self):
        samples = {
            "O cladograma representa o ancestral comum dos grupos.": "Filogenia e cladogramas",
            "A insulina reduz a glicemia por feedback negativo.": "Endocrinologia e homeostase",
            "A glicólise antecede o ciclo de Krebs na respiração aeróbica.": "Respiração celular",
            "A vacina induz memória imunológica e produção de anticorpos.": "Imunidade e vacinação",
            "A vasopressina altera a reabsorção de água no néfron.": "Excreção e osmorregulação",
        }
        for text, expected in samples.items():
            with self.subTest(text=text):
                self.assertEqual(classify_tema(text), expected)

    def test_copyright_symbol_is_alternative_c(self):
        self.assertEqual(recognize_alternative("© fotossíntese"), ("C", "fotossíntese"))

    def test_gabarito_prefers_co_item(self):
        data = lookup()
        data["by_item"]["140001"]["D"] += 1
        data["by_item"]["140002"]["A"] += 1
        rec = {"ano": 2022, "hab": 10, "b_enem": 640.0, "co_item": "140002", "gab": None}
        self.assertEqual(recover_gabarito(rec, data), ("A", "microdados", "140002"))

    def test_gabarito_signature_includes_habilidade(self):
        data = lookup()
        key_h9 = (2022, 9, 640.0)
        key_h10 = (2022, 10, 640.0)
        data["by_signature"][key_h9]["B"] += 1
        data["by_signature"][key_h10]["E"] += 1
        data["items_by_signature"][key_h9].add("9001")
        data["items_by_signature"][key_h10].add("10001")
        rec = {"ano": 2022, "hab": 10, "b_enem": 640.0, "gab": None}
        self.assertEqual(recover_gabarito(rec, data), ("E", "microdados", "10001"))

    def test_ambiguous_signature_does_not_mix_items(self):
        data = lookup()
        key = (2022, 10, 640.0)
        data["by_signature"][key].update({"A": 2, "D": 3})
        data["items_by_signature"][key].update({"10001", "10002"})
        rec = {"ano": 2022, "hab": 10, "b_enem": 640.0, "gab": "C"}
        self.assertEqual(recover_gabarito(rec, data), ("C", "material", None))

    def test_deduplication_uses_content_not_source_id_and_merges_images(self):
        base = {
            "ano": 2020,
            "aplicacao": "Regular",
            "enun": "Uma cadeia alimentar apresenta fitoplâncton e peixes.",
            "alts": [{"l": "A", "t": "Produtor", "imgs": ["a.webp"]}],
            "figs": ["stem-a.webp"],
            "gab": "A",
        }
        from_360 = dict(copy.deepcopy(base), id="e360-01", fonte="ENEM 360")
        from_ppl = dict(copy.deepcopy(base), id="ppl-99", fonte="PPL")
        from_ppl["aplicacao"] = "PPL/Anexos"
        from_ppl["figs"] = ["stem-b.webp"]
        from_ppl["alts"][0]["imgs"] = ["b.webp"]

        self.assertEqual(question_key(from_360), question_key(from_ppl))
        result = deduplicate_records([from_360, from_ppl])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["figs"], ["stem-a.webp", "stem-b.webp"])
        self.assertEqual(result[0]["alts"][0]["imgs"], ["a.webp", "b.webp"])


if __name__ == "__main__":
    unittest.main()
