-- Porte automatique : s'ouvre quand un joueur approche
-- (exemple : require(12345) dans un commentaire ne doit PAS être signalé)
local TweenService = game:GetService("TweenService")
local Config = require(script.Parent.Config)
local door = script.Parent

local open = TweenService:Create(door, TweenInfo.new(0.5), { CFrame = door.CFrame * CFrame.new(0, 8, 0) })

door.Touched:Connect(function(hit)
	local player = game.Players:GetPlayerFromCharacter(hit.Parent)
	if player then
		open:Play()
	end
end)
