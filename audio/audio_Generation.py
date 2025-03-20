from gtts import gTTS


voiceovers = {
    "living_room": "Welcome to the luxury living room. This space features a comfortable designer sofa, a state-of-the-art smart TV, and elegant decor for a premium experience.",
    "kitchen": "This is the modern kitchen, equipped with high-end stainless steel appliances, a spacious marble countertop, and stylish pendant lighting.",
    "master_bedroom": "Step into the master bedroom, featuring a king-sized bed, plush bedding, a cozy seating area, and a breathtaking city view from the large windows."
}


for room, text in voiceovers.items():
    tts = gTTS(text=text, lang="en")
    file_path = f"{room}_voiceover.mp3"
    tts.save(file_path)
    print(f"Voiceover saved: {file_path}")
